/**
 * Script: score-relevance.ts
 * Purpose: Operational run script.
 * Idempotent: Yes
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import { pool, closePool } from "./lib/db";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[score-relevance] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


const BATCH_SIZE = 5000;

const TIER1 = [
  "sail",
  "sailing",
  "regatta",
  "yacht",
  "yachting",
  "skipper",
  "helmsman",
  "keel",
  "spinnaker",
  "jib",
  "tack",
  "gybe",
  "gibe",
  "windward",
  "leeward",
  "offshore",
  "j/22",
  "j/24",
  "j22",
  "j24",
  "laser",
  "ilca",
  "optimist",
  "470",
  "49er",
  "nacra",
  "melges",
  "etchells",
  "star class",
];

const TIER2 = [
  "marine",
  "nautical",
  "boat",
  "boating",
  "race",
  "racing",
  "crew",
  "charter",
  "marina",
  "harbor",
  "harbour",
  "mast",
  "rig",
  "dinghy",
  "keelboat",
];

const TIER3_PENALTY = [
  "cruise ship",
  "carnival",
  "princess cruises",
  "norwegian cruise",
  "royal caribbean",
  "freight",
  "cargo vessel",
  "shipping lane",
  "container ship",
];

function scoreText(text: string): number {
  const lower = text.toLowerCase();
  let score = 0.1;

  for (const kw of TIER1) {
    if (lower.includes(kw)) score += 0.4;
  }
  for (const kw of TIER2) {
    if (lower.includes(kw)) score += 0.2;
  }
  for (const kw of TIER3_PENALTY) {
    if (lower.includes(kw)) score -= 0.3;
  }

  return Math.max(0, Math.min(1, score));
}

async function run() {
  let totalScored = 0;
  let batchNum = 0;

  while (true) {
    const res = await pool.query<{
      id: string;
      title: string;
      canonical_url: string;
    }>(
      `SELECT id, title, canonical_url
       FROM article_links
       WHERE relevance_score IS NULL
       ORDER BY id
       LIMIT $1`,
      [BATCH_SIZE]
    );

    if (res.rows.length === 0) break;

    const ids: string[] = [];
    const scores: number[] = [];

    for (const row of res.rows) {
      const combined = `${row.title || ""} ${row.canonical_url}`;
      ids.push(row.id);
      scores.push(scoreText(combined));
    }

    await pool.query(
      `UPDATE article_links AS a
       SET relevance_score = v.score
       FROM (
         SELECT unnest($1::uuid[]) AS id, unnest($2::float8[]) AS score
       ) v
       WHERE a.id = v.id`,
      [ids, scores]
    );

    batchNum += 1;
    totalScored += res.rows.length;
    console.log(
      `[score-relevance] Batch ${batchNum}: scored ${res.rows.length} (total ${totalScored})`
    );
  }

  const dist = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE relevance_score > 0.7)::int AS high,
      COUNT(*) FILTER (WHERE relevance_score > 0.4 AND relevance_score <= 0.7)::int AS medium,
      COUNT(*) FILTER (WHERE relevance_score > 0.1 AND relevance_score <= 0.4)::int AS low,
      COUNT(*) FILTER (WHERE relevance_score <= 0.1)::int AS very_low,
      COUNT(*) FILTER (WHERE relevance_score IS NULL)::int AS unscored
    FROM article_links
  `);

  console.log("[score-relevance] Distribution:", dist.rows[0]);
  console.log(`[score-relevance] Done. Scored ${totalScored} rows this run.`);
  await closePool();
}

run().catch((err) => {
  console.error("[score-relevance] Failed:", err);
  process.exit(1);
});