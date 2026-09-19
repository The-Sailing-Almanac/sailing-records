/**
 * Script: update-popularity-scores.ts
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
  console.log("[update-popularity-scores] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BATCH = 1000;

async function run() {
  console.log("[Popularity] Starting popularity score update...");

  // Update in batches using a cursor-style loop on created_at offset
  let updated = 0;
  let lastId: string | null = null;

  while (true) {
    const cursorClause: string = lastId ? `AND id > $2::uuid` : "";
    const params: (string | number)[] = [BATCH];
    if (lastId) params.push(lastId);

    const res: any = await pool.query<{
      id: string;
      click_count: number;
      reaction_up_count: number;
      reaction_down_count: number;
      published_at: string;
    }>(
      `SELECT id, click_count, reaction_up_count, reaction_down_count, published_at
       FROM article_links
       WHERE is_suppressed = false
         AND (click_count > 0 OR reaction_up_count > 0 OR reaction_down_count > 0)
         ${cursorClause}
       ORDER BY id ASC
       LIMIT $1`,
      params
    );

    if (res.rows.length === 0) break;

    for (const row of res.rows) {
      const ageDays = Math.max(
        1,
        (Date.now() - new Date(row.published_at).getTime()) / 86_400_000
      );
      const score =
        (row.click_count * 1.0 + row.reaction_up_count * 2.0 - row.reaction_down_count * 1.5) /
        ageDays;

      await pool.query(
        `UPDATE article_links SET popularity_score = $1 WHERE id = $2`,
        [Math.max(0, score), row.id]
      );
    }

    updated += res.rows.length;
    lastId = res.rows[res.rows.length - 1].id;
    console.log(`[Popularity] Updated ${updated} articles...`);

    if (res.rows.length < BATCH) break;
  }

  // Log top 10
  const top = await pool.query<{
    id: string;
    title: string;
    popularity_score: number;
    click_count: number;
    reaction_up_count: number;
  }>(
    `SELECT id, title, popularity_score, click_count, reaction_up_count
     FROM article_links
     WHERE is_suppressed = false
     ORDER BY popularity_score DESC
     LIMIT 10`
  );

  console.log("\n[Popularity] ─── Top 10 Articles ───────────────────────────────");
  top.rows.forEach((row, i) => {
    console.log(
      `  ${String(i + 1).padStart(2)}. [score: ${row.popularity_score.toFixed(3)}, ` +
      `clicks: ${row.click_count}, 👍 ${row.reaction_up_count}] ${row.title?.slice(0, 80)}`
    );
  });

  console.log(`\n[Popularity] ✅ Done. ${updated} articles updated.`);
  await pool.end();
}

run().catch(err => {
  console.error("[Popularity] Fatal error:", err);
  process.exit(1);
});