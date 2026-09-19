import { Pool } from "pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Queue } from "bullmq";
import { extractArticle } from "./text-extractor.js";
import { generateUrlHash, normalizeUrl } from "./lib/dedup.js";
import { detectLanguage } from "./lib/language-detect.js";
import { RobotsChecker } from "./lib/robots.js";
import { DomainRateLimiter } from "./lib/rate-limiter.js";

export interface FetchJobData {
  url: string;
  domain: string;
  rateLimitMs: number;
  crawlerSource: "sitemap" | "pagination";
}

const USER_AGENT = "SailingAlmanac-Crawler/1.0 (+https://sailingalmanac.org/about)";

export async function fetchAndStore(
  job: FetchJobData,
  pool: Pool,
  s3: S3Client,
  b2Bucket: string,
  spnQueue: Queue,
  robots: RobotsChecker,
  rateLimiter: DomainRateLimiter
): Promise<void> {
  const normalized = normalizeUrl(job.url);
  const urlHash = generateUrlHash(normalized);

  const urlObj = new URL(normalized);
  const allowed = await robots.isAllowed(job.domain, urlObj.pathname);
  if (!allowed) {
    console.log(`[Fetcher] robots.txt disallows ${normalized} — skipping`);
    return;
  }

  await rateLimiter.wait(job.domain, job.rateLimitMs);

  const res = await fetch(normalized, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${normalized}`);
  const html = await res.text();

  const extracted = extractArticle(html, normalized);

  const tld = job.domain.split(".").pop();
  const language = detectLanguage(extracted.text_extracted, { tld });

  const b2Key = `articles/${job.domain}/${urlHash}.json`;
  const b2Payload = {
    url: normalized,
    crawled_at: new Date().toISOString(),
    language,
    title: extracted.title,
    author: extracted.author,
    published_at: extracted.published_at,
    html_raw: html,
    text_extracted: extracted.text_extracted,
    word_count: extracted.word_count,
    schema_org: extracted.schema_org,
    og_tags: {
      description: extracted.og_description,
      image: extracted.og_image,
    },
  };

  await s3.send(new PutObjectCommand({
    Bucket: b2Bucket,
    Key: b2Key,
    Body: JSON.stringify(b2Payload),
    ContentType: "application/json",
  }));

  await pool.query(
    `INSERT INTO article_links
       (url_hash, canonical_url, title, content_snippet, publisher_name,
        published_at, og_image_url, full_text_b2_key, full_text_language,
        full_text_status, crawler_source, content_type, relevance_version)
     VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8, $9, $10, $11, 'article', NULL)
     ON CONFLICT (url_hash) DO UPDATE SET
       full_text_b2_key   = EXCLUDED.full_text_b2_key,
       full_text_language = EXCLUDED.full_text_language,
       full_text_status   = EXCLUDED.full_text_status,
       crawler_source     = EXCLUDED.crawler_source`,
    [
      urlHash,
      normalized,
      extracted.title,
      extracted.og_description ?? extracted.text_extracted.slice(0, 300),
      job.domain,
      extracted.published_at,
      extracted.og_image,
      b2Key,
      language,
      extracted.is_paywalled ? "paywalled" : "extracted",
      job.crawlerSource,
    ]
  );

  await spnQueue.add("archive", { url: normalized }, {
    jobId: `spn-article-${urlHash}`,
    attempts: 5,
    backoff: { type: "exponential", delay: 15000 },
  });

  console.log(`[Fetcher] Stored ${normalized} (${language}, ${extracted.word_count} words, paywalled=${extracted.is_paywalled})`);
}
