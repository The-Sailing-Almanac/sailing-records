/**
 * Script: backfill-wayback-captures.ts
 * Purpose: Enqueues Wayback SPN capture jobs for all social deliveries that
 *          succeeded but do not yet have a completed archive capture.
 * Idempotent: Yes — BullMQ deduplicates by deterministic jobId; DB query
 *             filters out already-completed captures.
 * Dry-run: --dry-run flag prints eligible count without enqueuing.
 * Batch size: BACKFILL_BATCH_SIZE env var (default 25).
 */
import { Queue } from "bullmq";
import { pool, closePool } from "./lib/db";
import dotenv from "dotenv";

dotenv.config();

const QUEUE_NAME = "wayback-spn";
const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = parseInt(process.env.BACKFILL_BATCH_SIZE || "25", 10);

const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

async function getEligibleDeliveries(limit: number) {
  const res = await pool.query<{
    id: number;
    post_id: number;
    external_url: string;
    created_at: string;
  }>(
    `SELECT d.id, d.post_id, d.external_url, d.created_at
     FROM social_post_deliveries d
     LEFT JOIN social_post_captures c
       ON c.delivery_id = d.id
       AND c.capture_type = 'wayback_spn'
       AND c.status = 'completed'
     WHERE d.status = 'success'
       AND d.external_url IS NOT NULL
       AND d.external_url <> ''
       AND c.id IS NULL
     ORDER BY d.created_at ASC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}

async function getTotalEligible(): Promise<number> {
  const res = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM social_post_deliveries d
     LEFT JOIN social_post_captures c
       ON c.delivery_id = d.id
       AND c.capture_type = 'wayback_spn'
       AND c.status = 'completed'
     WHERE d.status = 'success'
       AND d.external_url IS NOT NULL
       AND d.external_url <> ''
       AND c.id IS NULL`
  );
  return parseInt(res.rows[0].count, 10);
}

async function main() {
  console.log(
    `\n[Backfill] Wayback SPN capture backfill${DRY_RUN ? " (DRY RUN)" : ""}`
  );
  console.log(`[Backfill] Auth mode: ${process.env.WAYBACK_ACCESS_KEY && process.env.WAYBACK_SECRET_KEY ? "AUTHENTICATED" : "ANONYMOUS"}`);
  console.log(`[Backfill] Batch size: ${BATCH_SIZE}`);

  const totalEligible = await getTotalEligible();
  console.log(`[Backfill] Total eligible deliveries needing capture: ${totalEligible}`);

  if (totalEligible === 0) {
    console.log("[Backfill] Nothing to backfill. All deliveries are captured.");
    await closePool();
    return;
  }

  if (DRY_RUN) {
    console.log("[Backfill] --dry-run active. No jobs enqueued.");
    await closePool();
    return;
  }

  const rows = await getEligibleDeliveries(BATCH_SIZE);
  console.log(`[Backfill] Enqueuing ${rows.length} of ${totalEligible} eligible deliveries (batch size=${BATCH_SIZE})...`);

  const queue = new Queue(QUEUE_NAME, { connection: redisConnection });
  let enqueued = 0;
  let skipped = 0;

  for (const row of rows) {
    const jobId = `wayback-spn-del-${row.id}`;
    try {
      const result = await queue.add(
        "archive",
        { url: row.external_url, postId: row.post_id, deliveryId: row.id },
        {
          jobId,
          attempts: 5,
          backoff: { type: "exponential", delay: 15000 },
        }
      );
      if (result) {
        enqueued++;
      } else {
        skipped++; // Job already in queue (duplicate)
      }
    } catch (err: any) {
      // BullMQ throws on exact duplicate jobId when job is not completed yet
      if (err.message?.includes("already exists")) {
        skipped++;
      } else {
        console.error(`[Backfill] Error enqueuing delivery ${row.id}:`, err.message);
      }
    }
  }

  await queue.close();
  await closePool();

  const remaining = totalEligible - enqueued;
  console.log(`\n[Backfill] Done.`);
  console.log(`  Enqueued:          ${enqueued}`);
  console.log(`  Skipped (dup):     ${skipped}`);
  console.log(`  Remaining backlog: ${remaining}`);
  if (remaining > 0) {
    console.log(`  Run again to process the next batch of ${BATCH_SIZE}.`);
  }
}

main().catch((err) => {
  console.error("[Backfill] Fatal error:", err);
  process.exit(1);
});
