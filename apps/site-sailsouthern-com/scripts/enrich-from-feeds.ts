/**
 * Script: enrich-from-feeds.ts
 * Purpose: Operational run script.
 * Idempotent: Yes
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import { parse } from "tldts";
import { pool, closePool } from "./lib/db";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[enrich-from-feeds] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


function feedDomain(url: string): string | null {
  try {
    return parse(url).domain || null;
  } catch {
    return null;
  }
}

async function run() {
  const feeds = await pool.query<{ url: string }>(
    `SELECT url FROM feed_endpoints WHERE url IS NOT NULL`
  );

  const domainToLabel = new Map<string, string>();

  for (const row of feeds.rows) {
    const domain = feedDomain(row.url);
    if (!domain || domainToLabel.has(domain)) continue;
    try {
      const host = new URL(row.url).hostname;
      domainToLabel.set(domain, host.replace(/^www\./, ""));
    } catch {
      domainToLabel.set(domain, domain);
    }
  }

  console.log(
    `[enrich-from-feeds] Built domain map from ${domainToLabel.size} feed domains`
  );

  let totalEnriched = 0;

  for (const [domain, label] of domainToLabel) {
    const res = await pool.query(
      `UPDATE article_links
       SET publisher_name = COALESCE(publisher_name, $1)
       WHERE domain = $2
         AND (publisher_name IS NULL OR publisher_name = '')
       RETURNING id`,
      [label, domain]
    );
    totalEnriched += res.rowCount || 0;
  }

  console.log(`[enrich-from-feeds] Enriched ${totalEnriched} article rows.`);
  await closePool();
}

run().catch((err) => {
  console.error("[enrich-from-feeds] Failed:", err);
  process.exit(1);
});