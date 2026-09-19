import { Worker } from "bullmq";
import { Pool } from "pg";
import dotenv from "dotenv";
import { logger } from "@stax/logger";
import { generateRSAKeyPair, computeDigest, signActivityPubRequest } from "@stax/activity-core";

dotenv.config();

const QUEUE_NAME = "activitypub-outbound";

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

logger.info(`[ActivityPubOutbox] Initializing worker daemon for queue: "${QUEUE_NAME}"`);

export const outboxWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { actorId, inboxUrl, activity } = job.data;
    if (!actorId || !inboxUrl || !activity) {
      throw new Error("Job payload missing 'actorId', 'inboxUrl', or 'activity'");
    }

    // 1. Retrieve or generate actor keys
    let keysRes = await dbPool.query(
      "SELECT public_key, private_key FROM actor_keys WHERE actor_id = $1",
      [actorId]
    );

    let publicKeyPem: string;
    let privateKeyPem: string;

    if (keysRes.rowCount === 0) {
      logger.info(`[ActivityPubOutbox] No keys found for actor ${actorId}. Generating dynamically...`);
      const keys = generateRSAKeyPair();
      try {
        await dbPool.query(
          "INSERT INTO actor_keys (actor_id, public_key, private_key) VALUES ($1, $2, $3) ON CONFLICT (actor_id) DO NOTHING",
          [actorId, keys.publicKey, keys.privateKey]
        );
      } catch (insertErr) {
        logger.warn(`[ActivityPubOutbox] Key insertion conflict for ${actorId}`, { error: String(insertErr) });
      }
      
      const recheckRes = await dbPool.query(
        "SELECT public_key, private_key FROM actor_keys WHERE actor_id = $1",
        [actorId]
      );
      if (recheckRes.rowCount === 0) {
        throw new Error(`Failed to retrieve generated keys for actor ${actorId}`);
      }
      publicKeyPem = recheckRes.rows[0].public_key;
      privateKeyPem = recheckRes.rows[0].private_key;
    } else {
      publicKeyPem = keysRes.rows[0].public_key;
      privateKeyPem = keysRes.rows[0].private_key;
    }

    // 2. Build HTTP request signature and body
    const body = JSON.stringify(activity);
    const parsedInbox = new URL(inboxUrl);
    const host = parsedInbox.host;
    const targetPath = parsedInbox.pathname + parsedInbox.search;
    const date = new Date().toUTCString();
    const digest = computeDigest(body);

    const signature = signActivityPubRequest({
      privateKeyPem,
      keyId: `${actorId}#main-key`,
      method: "POST",
      targetPath,
      host,
      date,
      digest,
    });

    logger.info(`[ActivityPubOutbox] Delivering activity "${activity.type}" (job ${job.id}) from ${actorId} to ${inboxUrl}`);

    // 3. Make HTTP request with signature headers
    const response = await fetch(inboxUrl, {
      method: "POST",
      headers: {
        "Host": host,
        "Date": date,
        "Digest": digest,
        "Signature": signature,
        "Content-Type": "application/activity+json",
        "Accept": "application/activity+json",
      },
      body,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Delivery to ${inboxUrl} failed with status ${response.status}: ${errText}`);
    }

    logger.info(`[ActivityPubOutbox] Successfully delivered activity "${activity.type}" (job ${job.id}) to ${inboxUrl}`);
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

outboxWorker.on("failed", (job, err) => {
  logger.error(`[ActivityPubOutbox] Job ${job?.id} failed with error:`, err);
});

outboxWorker.on("completed", (job) => {
  logger.info(`[ActivityPubOutbox] Job ${job?.id} completed successfully.`);
});

process.on("SIGTERM", async () => {
  logger.info("[ActivityPubOutbox] Shutting down gracefully...");
  await outboxWorker.close();
  await dbPool.end();
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  logger.error("[ActivityPubOutbox] Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("[ActivityPubOutbox] Unhandled rejection:", reason);
});
