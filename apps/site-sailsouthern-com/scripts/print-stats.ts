/**
 * Script: print-stats.ts
 * Purpose: Operational run script.
 * Idempotent: Yes
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import { pool, closePool } from "./lib/db";
import { getArticleIndex } from "./lib/meili";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[print-stats] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


async function main() {
  const articles = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE is_suppressed = TRUE)::int AS suppressed,
      COUNT(*) FILTER (WHERE relevance_score > 0.7)::int AS high,
      COUNT(*) FILTER (WHERE relevance_score > 0.4 AND relevance_score <= 0.7)::int AS medium,
      COUNT(*) FILTER (WHERE relevance_score > 0.1 AND relevance_score <= 0.4)::int AS low,
      COUNT(*) FILTER (WHERE relevance_score <= 0.1)::int AS very_low
    FROM article_links
  `);

  const feeds = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active,
      COUNT(*) FILTER (WHERE last_checked_at IS NULL)::int AS unvalidated
    FROM feed_endpoints
  `);

  let meiliDocs = 0;
  try {
    meiliDocs = (await getArticleIndex().getStats()).numberOfDocuments;
  } catch {
    meiliDocs = 0;
  }

  console.log(JSON.stringify({ articles: articles.rows[0], feeds: feeds.rows[0], meiliDocs }, null, 2));
  await closePool();
}

main();
