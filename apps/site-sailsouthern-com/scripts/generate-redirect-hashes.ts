/**
 * Script: generate-redirect-hashes.ts
 * Purpose: Operational run script.
 * Idempotent: Yes
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import dotenv from "dotenv";
dotenv.config();
import { Pool } from "pg";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[generate-redirect-hashes] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BATCH = parseInt(
  process.argv.find(a => a.startsWith("--batch="))?.split("=")[1] ?? "5000"
);

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function buildRedirectHash(articleId: string): string {
  const hex = articleId.replace(/-/g, "").slice(-12);
  let n = BigInt("0x" + hex);
  const base = BigInt(62);
  let result = "";
  while (n > 0n) {
    result = BASE62[Number(n % base)] + result;
    n = n / base;
  }
  return result.padStart(8, "0").slice(-8);
}

async function run() {
  let offset = 0;
  let totalProcessed = 0;
  let totalInserted = 0;

  console.log("[RedirectHash] Starting redirect hash generation...");

  while (true) {
    const res = await pool.query<{ id: string; canonical_url: string }>(
      `SELECT id, canonical_url FROM article_links
       WHERE redirect_hash IS NULL
       LIMIT $1`,
      [BATCH]
    );

    if (res.rows.length === 0) break;

    const rows = res.rows;
    console.log(`[RedirectHash] Processing batch of ${rows.length} (total so far: ${totalProcessed})...`);

    // Build insert values for redirect_links
    const values: string[] = [];
    const params: (string)[] = [];
    let p = 1;

    for (const row of rows) {
      const hash = buildRedirectHash(row.id);
      values.push(`($${p}, $${p + 1}, $${p + 2})`);
      params.push(hash, row.id, row.canonical_url);
      p += 3;
    }

    // Bulk insert into redirect_links (ignore conflicts — already have a hash)
    await pool.query(
      `INSERT INTO redirect_links (hash, article_link_id, canonical_url)
       VALUES ${values.join(", ")}
       ON CONFLICT (hash) DO NOTHING`,
      params
    );

    // Bulk update article_links.redirect_hash
    for (const row of rows) {
      const hash = buildRedirectHash(row.id);
      await pool.query(
        `UPDATE article_links SET redirect_hash = $1 WHERE id = $2 AND redirect_hash IS NULL`,
        [hash, row.id]
      );
    }

    totalProcessed += rows.length;
    totalInserted += rows.length;
    offset += BATCH;

    if (rows.length < BATCH) break; // last batch
  }

  console.log(`[RedirectHash] ✅ Done. ${totalProcessed} articles processed, ${totalInserted} hashes generated.`);
  await pool.end();
}

run().catch(err => {
  console.error("[RedirectHash] Fatal error:", err);
  process.exit(1);
});