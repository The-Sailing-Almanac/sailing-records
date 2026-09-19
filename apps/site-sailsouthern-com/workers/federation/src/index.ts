import { logger } from "@stax/logger";
import { startNostrPublisherDaemon } from "./nostr-publisher";
import { startBlueskyFeedGenerator } from "./bluesky-feed-generator";
import { outboxWorker } from "./activitypub-outbox";
import { waybackWorker, startWaybackScannerDaemon } from "./wayback-spn";
import { startMetricsWorkerDaemon } from "./metrics-worker";
import { startSchedulerDaemon } from "./scheduler";

logger.info("[FederationWorker] Starting all federation daemons...");

// 1. Start ActivityPub Outbox Worker
logger.info("[FederationWorker] ActivityPub outbox worker initialized and listening on 'activitypub-outbound' queue.");

// 2. Start Nostr Publisher Daemon
startNostrPublisherDaemon();
logger.info("[FederationWorker] Nostr publisher daemon started.");

// 3. Start Bluesky Feed Generator
startBlueskyFeedGenerator();
logger.info("[FederationWorker] Bluesky feed generator server started.");

// 4. Start Wayback SPN Worker & Scanner
startWaybackScannerDaemon();
logger.info("[FederationWorker] Wayback SPN worker and scanner daemon started.");

// 5. Start Metrics Snapshot Worker
startMetricsWorkerDaemon();
logger.info("[FederationWorker] Outbound social metrics snapshot daemon started.");

// 6. Start Social Publishing Scheduler Daemon
startSchedulerDaemon();
logger.info("[FederationWorker] Social publishing scheduler daemon started.");

// Handle global shutdown
process.on("SIGTERM", async () => {
  logger.info("[FederationWorker] SIGTERM received. Shutting down gracefully...");
  await outboxWorker.close();
  await waybackWorker.close();
  process.exit(0);
});
