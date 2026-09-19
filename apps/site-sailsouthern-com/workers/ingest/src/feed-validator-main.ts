import { logger } from "@stax/logger";
/**
 * Daemon entry: runs feed validation worker and periodically enqueues batches.
 */
import dotenv from "dotenv";
import {
  feedValidatorWorker,
  enqueueUnvalidatedFeeds,
} from "./feed-validator";

dotenv.config();

const ENQUEUE_INTERVAL_MS = 5 * 60 * 1000;

async function main() {
  logger.info("[Feed Validator] Starting worker daemon...");

  await enqueueUnvalidatedFeeds();

  setInterval(async () => {
    try {
      await enqueueUnvalidatedFeeds();
    } catch (err) {
      logger.error("[Feed Validator] Enqueue error:", err);
    }
  }, ENQUEUE_INTERVAL_MS);
}

main().catch((err) => {
  logger.error("[Feed Validator] Fatal:", err);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  await feedValidatorWorker.close();
  process.exit(0);
});
