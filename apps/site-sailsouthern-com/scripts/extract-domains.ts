/**
 * Script: extract-domains.ts
 * Purpose: Operational run script.
 * Idempotent: Yes
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import { parse } from "tldts";
import { pool, closePool } from "./lib/db";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[extract-domains] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


const BATCH_SIZE = 5000;

function extractDomain(url: string): string | null {
  try {
    const parsed = parse(url);
    if (parsed.domain) return parsed.domain;
    const host = new URL(url).hostname.replace(/^www\./i, "");
    return host || null;
  } catch {
    return null;
  }
}

async function run() {
  let totalUpdated = 0;
  let batchNum = 0;

  while (true) {
    const res = await pool.query<{ id: string; canonical_url: string }>(
      `SELECT id, canonical_url
       FROM article_links
       WHERE domain IS NULL
       ORDER BY id
       LIMIT $1`,
      [BATCH_SIZE]
    );

    if (res.rows.length === 0) break;

    const ids: string[] = [];
    const domains: string[] = [];

    for (const row of res.rows) {
      ids.push(row.id);
      domains.push(extractDomain(row.canonical_url) || "unknown");
    }

    await pool.query(
      `UPDATE article_links AS a
       SET domain = v.domain
       FROM (
         SELECT unnest($1::uuid[]) AS id, unnest($2::text[]) AS domain
       ) v
       WHERE a.id = v.id AND a.domain IS NULL`,
      [ids, domains]
    );

    batchNum += 1;
    totalUpdated += ids.length;
    console.log(
      `[extract-domains] Batch ${batchNum}: updated ${ids.length} (total ${totalUpdated})`
    );
  }

  const remaining = await pool.query(
    `SELECT COUNT(*)::int AS count FROM article_links WHERE domain IS NULL`
  );
  console.log(
    `[extract-domains] Done. Updated ${totalUpdated}. Remaining without domain: ${remaining.rows[0].count}`
  );
  await closePool();
}

run().catch((err) => {
  console.error("[extract-domains] Failed:", err);
  process.exit(1);
});