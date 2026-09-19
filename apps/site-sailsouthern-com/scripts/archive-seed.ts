/**
 * Manual historical backfill trigger for a specific domain.
 * Usage: npm run archive-seed -- --domain sailingworld.com
 */
import dotenv from "dotenv";
dotenv.config();
import { Queue } from "bullmq";

const args = process.argv.slice(2);
const domainIdx = args.indexOf("--domain");
const domain = domainIdx !== -1 ? args[domainIdx + 1] : undefined;
if (!domain) { console.error("--domain required"); process.exit(1); }

const redis = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

const discoveryQueue = new Queue("archive-discovery", { connection: redis });

await discoveryQueue.add("discover", { domain, runType: "backfill" }, {
  jobId: `backfill-${domain}-${Date.now()}`,
});

console.log(`[ArchiveSeed] Enqueued full backfill discovery for ${domain}`);
process.exit(0);
