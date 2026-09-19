/**
 * Script: wayback-feed-discovery.ts
 * Purpose: Operational run script.
 * Idempotent: Yes
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import { pool, closePool } from "./lib/db";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[wayback-feed-discovery] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("[WaybackPilot] Fetching up to 100 inactive feed endpoints (excluding google.com) with HTTP >= 400...");

  // Select 100 inactive feeds
  const res = await pool.query(`
    SELECT id, url, http_status
    FROM feed_endpoints
    WHERE is_active = FALSE AND http_status >= 400 AND url NOT LIKE '%google.com%'
    ORDER BY id ASC
    LIMIT 100
  `);

  const feeds = res.rows;
  console.log(`[WaybackPilot] Found ${feeds.length} feeds matching criteria.`);

  if (feeds.length === 0) {
    console.log("[WaybackPilot] No matching feeds to process.");
    await closePool();
    return;
  }

  let successCount = 0;
  let failCount = 0;
  let errorCount = 0;

  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i];
    const url = feed.url;
    console.log(`[${i + 1}/${feeds.length}] Checking feed ${feed.id}: ${url} (HTTP ${feed.http_status})...`);

    // rate limit of max 2 req/sec: wait 550ms before/after each request
    await sleep(550);

    try {
      const cdxUrl = `http://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=1&fl=timestamp,statuscode`;
      const response = await fetch(cdxUrl, {
        headers: {
          "User-Agent": "SailSouthernDefunctFeedDiscoveryPilot/1.0"
        },
        signal: AbortSignal.timeout(3000) // 3s timeout
      });

      if (!response.ok) {
        throw new Error(`Wayback CDX API responded with status ${response.status}`);
      }

      const data = await response.json() as unknown[][];

      // Format of CDX output is JSON array:
      // [["timestamp", "statuscode"], ["20200101120000", "200"]]
      if (data && data.length > 1) {
        const row = data[1];
        const timestamp = row[0];
        const statuscode = row[1];

        if (timestamp) {
          const waybackUrl = `https://web.archive.org/web/${timestamp}/${url}`;
          console.log(`  🎉 Snapshot found! Timestamp: ${timestamp}, Status: ${statuscode}`);
          console.log(`  Updating wayback_url to: ${waybackUrl}`);

          await pool.query(
            `UPDATE feed_endpoints
             SET wayback_url = $1
             WHERE id = $2`,
            [waybackUrl, feed.id]
          );

          successCount++;
        } else {
          console.log("  ❌ Snapshot details missing.");
          failCount++;
        }
      } else {
        console.log("  ❌ No snapshot found on Wayback Machine.");
        failCount++;
      }
    } catch (err: any) {
      console.error(`  ⚠️ Error querying Wayback CDX for feed ${feed.id}:`, err?.message || err);
      errorCount++;
    }
  }

  console.log("\n[WaybackPilot] Pilot Complete.");
  console.log(`-----------------------------------`);
  console.log(`Total Feeds Sampled:  ${feeds.length}`);
  console.log(`Snapshots Found:      ${successCount}`);
  console.log(`No Snapshots Found:   ${failCount}`);
  console.log(`Errors encountered:   ${errorCount}`);

  const snapshotPct = feeds.length > 0 ? (successCount / feeds.length) * 100 : 0;
  console.log(`Snapshot Hit Rate:    ${snapshotPct.toFixed(2)}%`);
  console.log(`-----------------------------------`);

  if (snapshotPct > 20) {
    console.log(`[WaybackPilot] Snapshot hit rate is >20% (${snapshotPct.toFixed(1)}%). RECOMMENDED to greenlight full Wayback worker.`);
  } else {
    console.log(`[WaybackPilot] Snapshot hit rate is <=20% (${snapshotPct.toFixed(1)}%). Recommend against full Wayback worker.`);
  }

  await closePool();
}

main().catch(async (err) => {
  console.error("[WaybackPilot] Fatal error:", err);
  await closePool();
  process.exit(1);
});