import { logger } from "@stax/logger";
/**
 * workers/ingest/src/index.ts
 * Main entry point for the ingest worker daemon.
 * Polls all active feed_endpoints every 10 minutes.
 */
import { pollFeeds } from "./feed-poller";
import "./entity-extractor";

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

process.on("uncaughtException", (error) => {
  logger.error("[Fatal Ingest Worker uncaughtException]", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("[Fatal Ingest Worker unhandledRejection]", reason);
});

async function main() {
  logger.info("[Ingest Worker] Starting. Will poll feeds every 10 minutes.");

  // Initial poll on startup
  await pollFeeds();

  // Then poll on interval
  setInterval(async () => {
    await pollFeeds();
  }, POLL_INTERVAL_MS);
}

main().catch((err) => {
  logger.error("[Ingest Worker] Fatal error:", err);
  process.exit(1);
});
