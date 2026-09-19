import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

import { Worker, Queue } from "bullmq";
import { Pool } from "pg";
import { S3Client } from "@aws-sdk/client-s3";
import { seedDomainConfigs } from "./domain-configs.js";
import { fetchAndStore } from "./article-fetcher.js";
import { discoverUrls, buildSitemapUrls } from "./sitemap-discovery.js";
import { isKnownUrl } from "./lib/dedup.js";
import { RobotsChecker } from "./lib/robots.js";
import { DomainRateLimiter } from "./lib/rate-limiter.js";

const redis = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const s3 = new S3Client({
  endpoint: process.env.B2_ENDPOINT,
  region: process.env.B2_REGION || "us-east-005",
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APPLICATION_KEY!,
  },
});

const B2_BUCKET = process.env.B2_BUCKET_NAME!;

const discoveryQueue = new Queue("archive-discovery", { connection: redis });
const fetchQueue     = new Queue("archive-fetch",     { connection: redis });
const spnQueue       = new Queue("wayback-spn",       { connection: redis });

const robots      = new RobotsChecker();
const rateLimiter = new DomainRateLimiter();

new Worker("archive-discovery", async (job) => {
  const { domain, runType } = job.data as { domain: string; runType: string };
  console.log(`[Discovery] ${domain} — ${runType}`);

  const domainRes = await pool.query(
    "SELECT * FROM archive_domain_configs WHERE domain = $1 AND is_active = TRUE",
    [domain]
  );
  if (!domainRes.rows[0]) return;
  const config = domainRes.rows[0];

  await pool.query(
    "INSERT INTO archive_crawl_runs (domain, run_type) VALUES ($1, $2)",
    [domain, runType]
  );
  const runId = (await pool.query(
    "SELECT id FROM archive_crawl_runs WHERE domain = $1 ORDER BY started_at DESC LIMIT 1",
    [domain]
  )).rows[0].id;

  const sitemapUrls: string[] = config.sitemap_urls?.length
    ? config.sitemap_urls
    : buildSitemapUrls(domain);

  const discovered = await discoverUrls(domain, sitemapUrls);
  let newCount = 0;
  let skipped  = 0;

  for (const url of discovered) {
    const known = await isKnownUrl(url, pool.query.bind(pool));
    if (known) { skipped++; continue; }
    await fetchQueue.add("fetch", {
      url,
      domain,
      rateLimitMs: config.rate_limit_ms,
      crawlerSource: "sitemap",
    }, {
      jobId: `fetch-${Buffer.from(url).toString("base64").slice(0, 40)}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 10000 },
    });
    newCount++;
  }

  await pool.query(
    `UPDATE archive_crawl_runs
     SET urls_discovered = $1, urls_new = $2, urls_skipped = $3,
         status = 'completed', completed_at = NOW()
     WHERE id = $4`,
    [discovered.length, newCount, skipped, runId]
  );
  await pool.query(
    "UPDATE archive_domain_configs SET last_crawled_at = NOW() WHERE domain = $1",
    [domain]
  );

  console.log(`[Discovery] ${domain} — discovered=${discovered.length} new=${newCount} skipped=${skipped}`);
}, { connection: redis, concurrency: 2 });

new Worker("archive-fetch", async (job) => {
  await fetchAndStore(job.data, pool, s3, B2_BUCKET, spnQueue, robots, rateLimiter);
}, { connection: redis, concurrency: 3 });

async function runDiscovery(runType: "sitemap_news" | "sitemap_full") {
  const res = await pool.query(
    "SELECT domain, crawl_priority FROM archive_domain_configs WHERE is_active = TRUE ORDER BY crawl_priority ASC"
  );
  for (const row of res.rows) {
    await discoveryQueue.add("discover", { domain: row.domain, runType }, {
      jobId: `discover-${row.domain}-${runType}-${Date.now()}`,
    });
  }
  console.log(`[Scheduler] Enqueued ${runType} discovery for ${res.rows.length} domains`);
}

setInterval(() => runDiscovery("sitemap_news"), 30 * 60 * 1000);

setTimeout(() => {
  runDiscovery("sitemap_full");
  setInterval(() => runDiscovery("sitemap_full"), 7 * 24 * 60 * 60 * 1000);
}, 60 * 60 * 1000);

async function main() {
  await seedDomainConfigs(pool);
  console.log("[ArchiveWorker] Started. News sitemap discovery fires every 30 minutes.");
  await runDiscovery("sitemap_news");
}

main().catch(err => {
  console.error("[ArchiveWorker] Fatal:", err);
  process.exit(1);
});
