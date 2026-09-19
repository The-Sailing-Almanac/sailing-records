/**
 * Script: seed-sailboatdata-urls.ts
 * Purpose: Enqueue sailboatdata URLs into BullMQ rig-scrape queue.
 * Idempotent: Yes
 * Dry-run: --dry-run flag fetches and filters URLs without enqueuing or DB mutations.
 * Last run: 2026-05-28
 */
import dotenv from "dotenv";
dotenv.config();

import { Pool } from "pg";
import { Queue } from "bullmq";

const dryRun = process.argv.includes("--dry-run");

// Load limits or filters from argv
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 500;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

async function main() {
  console.log(`[RigSeeder] Starting. Target CDX limit: ${limit}. Dry Run: ${dryRun}`);

  // 1. Fetch URLs from CDX
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=sailboatdata.com/sailboat/*&output=json&collapse=urlkey&limit=${limit}`;
  console.log(`[RigSeeder] Fetching CDX archive metadata from: ${cdxUrl}`);
  
  const res = await fetch(cdxUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch CDX list: HTTP ${res.status}`);
  }
  const data = (await res.json()) as string[][];

  // Original URL is at index 2
  const rawUrls = data.slice(1).map((row) => row[2]);
  console.log(`[RigSeeder] Retrieved ${rawUrls.length} unique URLs from archive indexes.`);

  // Filter to design pages only and strip query/hash parameters
  const designUrlsRaw = rawUrls.map((u) => {
    try {
      const urlObj = new URL(u);
      urlObj.search = "";
      urlObj.hash = "";
      // Ensure it ends without trailing slash for normalization
      let cleanUrl = urlObj.toString();
      if (cleanUrl.endsWith("/")) {
        cleanUrl = cleanUrl.slice(0, -1);
      }
      return cleanUrl;
    } catch {
      return "";
    }
  });

  const designUrls = Array.from(new Set(designUrlsRaw)).filter((u) => {
    if (!u) return false;
    try {
      const urlObj = new URL(u);
      const pathParts = urlObj.pathname.split("/").filter(Boolean);
      // Path must look like: /sailboat/catalina-30
      // Exclude base, index, page listings and pdf versions
      return (
        pathParts.length >= 2 &&
        pathParts[0] === "sailboat" &&
        pathParts[1] !== "page" &&
        !urlObj.pathname.endsWith("/pdf")
      );
    } catch {
      return false;
    }
  });

  console.log(`[RigSeeder] Filtered down to ${designUrls.length} valid design URLs.`);

  // 2. Fetch already scraped URLs from the DB to keep script idempotent
  console.log("[RigSeeder] Querying existing boat sources from database...");
  const dbRes = await pool.query<{ source_url: string }>(
    `SELECT source_url FROM boat_sources`
  );
  const existingUrls = new Set(dbRes.rows.map((row) => row.source_url));
  console.log(`[RigSeeder] Found ${existingUrls.size} already ingested URLs in database.`);

  // Find newly discovered URLs
  const newUrls = designUrls.filter((u) => !existingUrls.has(u));
  console.log(`[RigSeeder] Identified ${newUrls.length} new URLs needing ingestion.`);

  if (newUrls.length === 0) {
    console.log("[RigSeeder] No new URLs to enqueue. Done!");
    await pool.end();
    return;
  }

  if (dryRun) {
    console.log("\n[RigSeeder] ─── Sample of New URLs (Dry Run) ────────────────────");
    newUrls.slice(0, 20).forEach((u) => console.log(`  - ${u}`));
    if (newUrls.length > 20) {
      console.log(`  ... and ${newUrls.length - 20} more.`);
    }
    console.log("[RigSeeder] [Dry Run] Success. Exiting without enqueuing.");
    await pool.end();
    return;
  }

  // 3. Initialize BullMQ Queue and enqueue jobs
  const rigQueue = new Queue("rig-scrape", {
    connection: redisConnection,
  });

  console.log(`[RigSeeder] Enqueuing ${newUrls.length} jobs in "rig-scrape" queue...`);
  
  for (const url of newUrls) {
    // Generate a unique job name/ID based on URL path to prevent duplicate active jobs
    const pathParts = new URL(url).pathname.split("/").filter(Boolean);
    const jobKey = pathParts[pathParts.length - 1];
    
    await rigQueue.add(
      "scrape-design",
      { url },
      { jobId: `scrape:${jobKey}` }
    );
  }

  console.log(`[RigSeeder] Successfully enqueued ${newUrls.length} ingestion jobs.`);
  
  await rigQueue.close();
  await pool.end();
  console.log("[RigSeeder] ✅ Done.");
}

main().catch((err) => {
  console.error("[RigSeeder] Fatal error:", err);
  process.exit(1);
});
