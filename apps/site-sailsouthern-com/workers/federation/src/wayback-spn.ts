import { Worker, Queue } from "bullmq";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { logger } from "@stax/logger";
import { Pool } from "pg";
import { sendGA4Event } from "@stax/activity-core";

dotenv.config();

const QUEUE_NAME = "wayback-spn";

const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const logDir = path.resolve(process.env.WORKSPACE_ROOT || "c:/Users/aewoo/.projects/repos/ss-sailsouthern-com", "runs");
const logFilePath = path.join(logDir, "archive-spn.log");

// Ensure logs directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function writeAuditLog(message: string) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFilePath, `[${timestamp}] ${message}\n`, "utf-8");
}

export const waybackQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
});

// ── Auth mode detection ──────────────────────────────────────────────────────
const WAYBACK_AUTH_MODE: "authenticated" | "anonymous" =
  process.env.WAYBACK_ACCESS_KEY && process.env.WAYBACK_SECRET_KEY
    ? "authenticated"
    : "anonymous";

logger.info(
  `[WaybackWorker] SPN auth mode: ${WAYBACK_AUTH_MODE.toUpperCase()}` +
  (WAYBACK_AUTH_MODE === "anonymous"
    ? " — set WAYBACK_ACCESS_KEY + WAYBACK_SECRET_KEY to enable authenticated SPN"
    : " — using Internet Archive S3 credentials")
);

async function saveCaptureStatus(
  postId: number,
  deliveryId: number,
  archiveUrl: string,
  status: "completed" | "failed",
  authMode: "authenticated" | "anonymous" = WAYBACK_AUTH_MODE
) {
  try {
    const existing = await dbPool.query(
      "SELECT id FROM social_post_captures WHERE delivery_id = $1 AND capture_type = 'wayback_spn'",
      [deliveryId]
    );

    if (existing.rows.length > 0) {
      await dbPool.query(
        "UPDATE social_post_captures SET status = $1, archive_url = $2, captured_at = NOW(), auth_mode = $3 WHERE id = $4",
        [status, archiveUrl, authMode, existing.rows[0].id]
      );
      logger.info(`[WaybackWorker] Updated capture (${authMode}) → ${status} for delivery ${deliveryId}`);
    } else {
      await dbPool.query(
        `INSERT INTO social_post_captures (post_id, delivery_id, capture_type, archive_url, status, auth_mode)
         VALUES ($1, $2, 'wayback_spn', $3, $4, $5)`,
        [postId, deliveryId, archiveUrl, status, authMode]
      );
      logger.info(`[WaybackWorker] Inserted capture (${authMode}) → ${status} for delivery ${deliveryId}`);
    }

    // Emit server-side GA4 Event for Wayback Capture
    if (status === "completed") {
      await sendGA4Event("social_capture_success", {
        post_id: postId,
        delivery_id: deliveryId,
        archive_url: archiveUrl
      });
    } else {
      await sendGA4Event("social_capture_failure", {
        post_id: postId,
        delivery_id: deliveryId,
        error_message: "Wayback capture marked as failed"
      });
    }
  } catch (dbErr) {
    logger.error(`[WaybackWorker] Failed to write capture status to database for delivery ${deliveryId}:`, dbErr);
  }
}

export const waybackWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { url, postId, deliveryId } = job.data;
    if (!url) {
      throw new Error("Job payload missing 'url'");
    }

    const accessKey = process.env.WAYBACK_ACCESS_KEY;
    const secretKey = process.env.WAYBACK_SECRET_KEY;
    const jobAuthMode: "authenticated" | "anonymous" =
      accessKey && secretKey ? "authenticated" : "anonymous";

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    };

    if (accessKey && secretKey) {
      headers["Authorization"] = `LOW ${accessKey}:${secretKey}`;
    }

    logger.info(`[WaybackWorker] Processing save for ${url} (job ${job.id}, mode=${jobAuthMode})`);

    // (auth mode already logged above)
    
    try {
      const response = await fetch("https://web.archive.org/save/", {
        method: "POST",
        headers,
        body: new URLSearchParams({ url })
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 15000;
        writeAuditLog(`RATE_LIMIT 429 for ${url} — Retrying after ${delay}ms`);
        logger.warn(`[WaybackWorker] Rate limited for ${url}. Will retry.`);
        throw new Error(`Wayback SPN rate limited (429), retry after ${delay}ms`);
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        const msg = `FAIL Status ${response.status} for ${url}: ${errText}`;
        writeAuditLog(msg);
        if (postId && deliveryId) {
          await saveCaptureStatus(postId, deliveryId, "", "failed", jobAuthMode);
        }
        throw new Error(msg);
      }

      const responseData = await response.text().catch(() => "");
      const location = response.headers.get("location") || response.headers.get("content-location") || "";
      const archiveUrl = location || `https://web.archive.org/web/${new Date().toISOString().replace(/[-:TZ]/g, "").substring(0, 14)}/${url}`;

      writeAuditLog(`SUCCESS (${jobAuthMode}) Status ${response.status} for ${url}: ${responseData.substring(0, 200)}`);
      logger.info(`[WaybackWorker] Successfully archived ${url} -> ${archiveUrl} (${jobAuthMode})`);

      if (postId && deliveryId) {
        await saveCaptureStatus(postId, deliveryId, archiveUrl, "completed", jobAuthMode);
      }
    } catch (err: any) {
      writeAuditLog(`ERROR (${jobAuthMode}) for ${url}: ${err.message || String(err)}`);
      if (postId && deliveryId && responseStatusIsNotRetryable(err)) {
        await saveCaptureStatus(postId, deliveryId, "", "failed", jobAuthMode);
      }
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
    limiter: {
      max: 3,
      duration: 10000,
    }
  }
);

function responseStatusIsNotRetryable(err: any): boolean {
  // If it's a rate limit or network error, let BullMQ retry.
  // Otherwise, record as failed.
  const msg = (err.message || String(err)).toLowerCase();
  if (msg.includes("429") || msg.includes("rate limited") || msg.includes("fetch failed")) {
    return false;
  }
  return true;
}

waybackWorker.on("failed", (job, err) => {
  logger.error(`[WaybackWorker] Job ${job?.id} failed:`, err);
});

waybackWorker.on("completed", (job) => {
  logger.info(`[WaybackWorker] Job ${job?.id} completed.`);
});

// Periodic database scanner daemon to pick up deliveries that need capture
export async function scanAndEnqueueUncapturedPosts() {
  try {
    const dbRes = await dbPool.query(`
      SELECT d.id, d.post_id, d.external_url
      FROM social_post_deliveries d
      LEFT JOIN social_post_captures c 
        ON c.delivery_id = d.id AND c.capture_type = 'wayback_spn' AND c.status = 'completed'
      WHERE d.status = 'success'
        AND d.external_url IS NOT NULL
        AND d.external_url <> ''
        AND c.id IS NULL
      ORDER BY d.created_at ASC
      LIMIT 50
    `);

    if (dbRes.rows.length === 0) {
      return;
    }

    logger.info(`[WaybackScanner] Found ${dbRes.rows.length} deliveries needing capture. Enqueuing...`);

    for (const row of dbRes.rows) {
      const jobId = `wayback-spn-del-${row.id}`;
      await waybackQueue.add("archive", 
        { 
          url: row.external_url, 
          postId: row.post_id, 
          deliveryId: row.id 
        },
        {
          jobId,
          attempts: 5,
          backoff: {
            type: "exponential",
            delay: 15000,
          }
        }
      );
    }
  } catch (err) {
    logger.error("[WaybackScanner] Error scanning uncaptured posts:", err);
  }
}

export function startWaybackScannerDaemon() {
  const crawlExpansionEnabled = process.env.CRAWL_EXPANSION_ENABLED !== "false";
  logger.info(
    `[WaybackScanner] Starting capture scanner daemon. ` +
    `CRAWL_EXPANSION_ENABLED=${crawlExpansionEnabled}, auth=${WAYBACK_AUTH_MODE}`
  );

  if (!crawlExpansionEnabled) {
    logger.info("[WaybackScanner] CRAWL_EXPANSION_ENABLED=false — scanner will NOT auto-enqueue. Set CRAWL_EXPANSION_ENABLED=true to enable.");
    return;
  }

  const intervalMs = parseInt(process.env.WAYBACK_SCAN_INTERVAL_MS || "", 10) || 5 * 60 * 1000;
  logger.info(`[WaybackScanner] Scanning every ${intervalMs / 1000}s for uncaptured deliveries.`);

  const tick = async () => {
    await scanAndEnqueueUncapturedPosts();
    setTimeout(tick, intervalMs);
  };

  tick();
}
