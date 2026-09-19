/**
 * Script: check-data-quality.ts
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
  console.log("[check-data-quality] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const LIMIT = parseInt(process.argv.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "500");
const BATCH_SIZE = 100;

interface ArticleRow {
  id: string;
  title: string | null;
  dek: string | null;
  extracted_text: string | null;
  og_image_url: string | null;
  published_at: string | null;
  author: string | null;
  relevance_score: number | null;
}

const WEIGHTS: { field: keyof ArticleRow; weight: number }[] = [
  { field: "title",          weight: 0.20 },
  { field: "dek",            weight: 0.15 },
  { field: "extracted_text", weight: 0.25 },
  { field: "og_image_url",   weight: 0.15 },
  { field: "published_at",   weight: 0.10 },
  { field: "author",         weight: 0.10 },
  { field: "relevance_score",weight: 0.05 },
];

function scoreRow(row: ArticleRow): { score: number; missing: string[] } {
  let score = 0;
  const missing: string[] = [];

  for (const { field, weight } of WEIGHTS) {
    const val = row[field];
    const present = val !== null && val !== undefined && String(val).trim().length > 0;
    if (present) {
      score += weight;
    } else {
      missing.push(field as string);
    }
  }

  return { score: Math.round(score * 100) / 100, missing };
}

async function run() {
  const res = await pool.query<ArticleRow>(
    `SELECT id, title, dek, extracted_text, og_image_url, published_at, author, relevance_score
     FROM article_links
     WHERE is_suppressed = false
       AND (dq_checked_at IS NULL OR dq_checked_at < NOW() - INTERVAL '7 days')
     ORDER BY created_at DESC
     LIMIT $1`,
    [LIMIT]
  );

  const rows = res.rows;
  console.log(`[DQ Audit] Checking ${rows.length} articles...`);

  let lowQuality = 0;
  let batchValues: string[] = [];
  let batchParams: (string | number | string[] | null)[] = [];
  let paramIdx = 1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const { score, missing } = scoreRow(row);

    if (score < 0.5) lowQuality++;

    batchValues.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, NOW())`);
    batchParams.push(row.id, score, missing);
    paramIdx += 3;

    // Flush batch
    if (batchValues.length >= BATCH_SIZE || i === rows.length - 1) {
      await pool.query(
        `UPDATE article_links AS a
            SET dq_score = v.score,
                dq_missing_fields = v.missing,
                dq_checked_at = v.checked_at
           FROM (VALUES ${batchValues.join(", ")}) AS v(id, score, missing, checked_at)
          WHERE a.id::text = v.id`,
        batchParams
      );
      batchValues = [];
      batchParams = [];
      paramIdx = 1;
    }
  }

  console.log(`[DQ Audit] ✅ Done.`);
  console.log(`[DQ Audit]   Total checked : ${rows.length}`);
  console.log(`[DQ Audit]   Low quality (<0.5): ${lowQuality} (${((lowQuality / rows.length) * 100).toFixed(1)}%)`);

  await pool.end();
}

run().catch((err) => {
  console.error("[DQ Audit] Fatal error:", err);
  process.exit(1);
});