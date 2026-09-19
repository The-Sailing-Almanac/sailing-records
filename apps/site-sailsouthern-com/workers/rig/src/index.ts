import { Worker } from "bullmq";
import { Pool } from "pg";
import dotenv from "dotenv";
import { logger } from "@stax/logger";
import { scrapeBoatPage } from "./sailboatdata-scraper";
import { scrapeYachtWorld } from "./yachtworld-scraper";

dotenv.config();

const QUEUE_NAME = "rig-scrape";
const YW_QUEUE_NAME = "yachtworld-scrape";

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

logger.info(`[RigWorker] Initializing worker daemons for queues: "${QUEUE_NAME}" and "${YW_QUEUE_NAME}"`);

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { url } = job.data;
    if (!url) {
      throw new Error("Job payload missing 'url'");
    }
    await scrapeBoatPage(url, dbPool);
  },
  {
    connection: redisConnection,
    concurrency: 1, // Keep concurrency at 1 for polite single-threaded crawl speed
  }
);

worker.on("failed", (job, err) => {
  logger.error(`[RigWorker] Sailboatdata job ${job?.id} failed with error:`, err);
});

worker.on("completed", (job) => {
  logger.info(`[RigWorker] Sailboatdata job ${job?.id} completed successfully.`);
});

const yachtworldWorker = new Worker(
  YW_QUEUE_NAME,
  async (job) => {
    const { builder, model } = job.data;
    if (!builder || !model) {
      throw new Error("Job payload missing 'builder' or 'model'");
    }
    await scrapeYachtWorld(builder, model, dbPool);
  },
  {
    connection: redisConnection,
    concurrency: 1, // Keep concurrency at 1 for polite single-threaded crawl speed
  }
);

yachtworldWorker.on("failed", (job, err) => {
  logger.error(`[YachtWorldWorker] Job ${job?.id} failed with error:`, err);
});

yachtworldWorker.on("completed", (job) => {
  logger.info(`[YachtWorldWorker] Job ${job?.id} completed successfully.`);
});

process.on("SIGTERM", async () => {
  logger.info("[RigWorker] Shutting down gracefully...");
  await worker.close();
  await yachtworldWorker.close();
  await dbPool.end();
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  logger.error("[RigWorker] Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("[RigWorker] Unhandled rejection:", reason);
});
