/**
 * Script: suppress-false-positives.ts
 * Purpose: Operational run script.
 * Idempotent: Yes
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import { pool, closePool } from "./lib/db";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[suppress-false-positives] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


const DOMAIN_PATTERNS = [
  "carnivalcorp.com",
  "princess.com",
  "ncl.com",
  "royalcaribbean.com",
  "msccruises.com",
  "hollandamerica.com",
  "vikingcruises.com",
  "cunard.com",
  "aida.de",
  "costacruises.com",
];

const TITLE_PATTERNS = [
  "carnival cruise",
  "cruise ship",
  "cruise line",
  "cruise vacation",
  "freight shipping",
  "container vessel",
  "cargo shipping",
];

async function run() {
  let totalSuppressed = 0;

  for (const domain of DOMAIN_PATTERNS) {
    const res = await pool.query(
      `UPDATE article_links
       SET is_suppressed = TRUE,
           suppression_reason = $1
       WHERE COALESCE(is_suppressed, false) = false
         AND (domain ILIKE $2 OR canonical_url ILIKE $3)
       RETURNING id`,
      [
        `domain:${domain}`,
        `%${domain}%`,
        `%${domain}%`,
      ]
    );
    if (res.rowCount) {
      console.log(`[suppress] domain ${domain}: ${res.rowCount}`);
      totalSuppressed += res.rowCount;
    }
  }

  for (const pattern of TITLE_PATTERNS) {
    const res = await pool.query(
      `UPDATE article_links
       SET is_suppressed = TRUE,
           suppression_reason = $1
       WHERE COALESCE(is_suppressed, false) = false
         AND title ILIKE $2
       RETURNING id`,
      [`title:${pattern}`, `%${pattern}%`]
    );
    if (res.rowCount) {
      console.log(`[suppress] title "${pattern}": ${res.rowCount}`);
      totalSuppressed += res.rowCount;
    }
  }

  const summary = await pool.query(
    `SELECT COUNT(*)::int AS total FROM article_links WHERE is_suppressed = TRUE`
  );

  console.log(
    `[suppress-false-positives] Suppressed ${totalSuppressed} rows this run. Total suppressed: ${summary.rows[0].total}`
  );
  await closePool();
}

run().catch((err) => {
  console.error("[suppress-false-positives] Failed:", err);
  process.exit(1);
});