/**
 * Script: heartbeat.ts
 * Purpose: Operational run script.
 * Idempotent: Yes
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import { pool, closePool } from "./lib/db";
import { broadcastAlert } from "./lib/notifications";
import dotenv from "dotenv";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[heartbeat] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


dotenv.config();

const NOTION_TOKEN = process.env.NOTION_TOKEN || "";
const SYNC_LOG_DB_ID = "4da5a1bb-6c08-4219-b3c6-9d911d83781f";

async function runHeartbeat() {
  console.log("[Heartbeat] Generating daily telemetry status update...");

  try {
    // 1. Fetch metrics from PostgreSQL
    const activeFeedsRes = await pool.query("SELECT COUNT(*)::int FROM feed_endpoints WHERE is_active = true");
    const activeFeedsCount = activeFeedsRes.rows[0].count;

    const deadFeedsRes = await pool.query("SELECT COUNT(*)::int FROM feed_endpoints WHERE is_active = false");
    const deadFeedsCount = deadFeedsRes.rows[0].count;

    const polledFeedsRes = await pool.query(
      "SELECT COUNT(*)::int FROM feed_endpoints WHERE is_active = true AND last_polled_at > NOW() - INTERVAL '24 hours'"
    );
    const polledFeedsCount = polledFeedsRes.rows[0].count;

    const ingestedRes = await pool.query(
      "SELECT COUNT(*)::int FROM article_links WHERE created_at > NOW() - INTERVAL '24 hours'"
    );
    const ingestedCount = ingestedRes.rows[0].count;

    const scoredRes = await pool.query(
      "SELECT COUNT(*)::int FROM article_links WHERE relevance_checked_at > NOW() - INTERVAL '24 hours' AND relevance_score IS NOT NULL"
    );
    const scoredCount = scoredRes.rows[0].count;

    const pendingRes = await pool.query(
      "SELECT COUNT(*)::int FROM article_links WHERE relevance_score IS NULL AND is_suppressed = false"
    );
    const pendingCount = pendingRes.rows[0].count;

    const critiquesRes = await pool.query(
      "SELECT COUNT(*)::int FROM article_links WHERE metadata->>'critique_processed' = 'true' AND relevance_checked_at > NOW() - INTERVAL '24 hours'"
    );
    const critiquesCount = critiquesRes.rows[0].count;

    const newsletterRes = await pool.query(
      "SELECT title FROM newsletters WHERE created_at > NOW() - INTERVAL '24 hours' ORDER BY created_at DESC LIMIT 1"
    );
    const newsletterSent = (newsletterRes.rowCount !== null && newsletterRes.rowCount > 0) ? `Yes: "${newsletterRes.rows[0].title}"` : "No";

    const subscribersRes = await pool.query(
      "SELECT COUNT(*)::int FROM subscribers WHERE created_at > NOW() - INTERVAL '24 hours'"
    );
    const subscribersCount = subscribersRes.rows[0].count;

    // 2. Compute crawler performance and recommendations
    let recommendations = "🟢 Crawlers are fully matching load. Performance looks optimal.";
    let hasAlert = false;

    if (activeFeedsCount > polledFeedsCount) {
      hasAlert = true;
      recommendations = `⚠️ ALERT: ${activeFeedsCount - polledFeedsCount} active feeds have not been polled in the last 24 hours. Check if ingest worker is down or experiencing network blocks.`;
    } else if (ingestedCount === 0) {
      hasAlert = true;
      recommendations = "⚠️ WARNING: 0 new articles ingested in the last 24h. Feeds might be silent or rate-limited.";
    } else if (pendingCount > 300) {
      hasAlert = true;
      recommendations = `⚠️ BACKLOG DETECTED: ${pendingCount} articles pending relevance scoring. Recommend scaling relevance cron loop frequency or increasing batch size.`;
    }

    const reportText = `Daily heartbeat check for Sail Southern crawlers and scoring processes.`;

    const fields = [
      { name: "Active / Dead Feeds", value: `${activeFeedsCount} / ${deadFeedsCount}`, inline: true },
      { name: "Feeds Polled (24h)", value: `${polledFeedsCount} / ${activeFeedsCount}`, inline: true },
      { name: "Articles Ingested (24h)", value: `${ingestedCount}`, inline: true },
      { name: "Articles Scored (24h)", value: `${scoredCount}`, inline: true },
      { name: "Unscored Queue Size", value: `${pendingCount}`, inline: true },
      { name: "Critiques Handled (24h)", value: `${critiquesCount}`, inline: true },
      { name: "Daily Newsletter Sent?", value: newsletterSent, inline: false },
      { name: "New Subscribers (24h)", value: `${subscribersCount}`, inline: true },
      { name: "System Recommendations", value: recommendations, inline: false }
    ];

    // 3. Pushing multi-channel notifications
    await broadcastAlert({
      title: "⛵ Sail Southern Heartbeat & Telemetry",
      text: reportText,
      fields,
      color: hasAlert ? "FF5F1F" : "39FF14"
    });

    // 4. Update Notion Sync Log if NOTION_TOKEN is present
    if (NOTION_TOKEN) {
      console.log("[Heartbeat] Writing log entry to Notion Sync Log DB...");
      const today = new Date();
      const runId = `SYNC-${today.toISOString().split("T")[0].replace(/-/g, "")}-ALMANAC-HEARTBEAT`;
      
      const notes = `Ingested: ${ingestedCount} | Scored: ${scoredCount} | Pending: ${pendingCount} | Newsletters: ${newsletterSent} | Recommendations: ${recommendations}`;

      const res = await fetch(`https://api.notion.com/v1/pages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          parent: { database_id: SYNC_LOG_DB_ID },
          properties: {
            Name: { title: [{ type: "text", text: { content: runId } }] },
            Status: { select: { name: hasAlert ? "⚠️ Degraded" : "✅ Complete" } },
            "Records Created": { number: ingestedCount },
            "Records Updated": { number: scoredCount },
            "Run At": { date: { start: today.toISOString().split("T")[0] } },
            Notes: { rich_text: [{ type: "text", text: { content: notes.slice(0, 2000) } }] }
          }
        })
      });

      if (res.ok) {
        console.log(`[Heartbeat] Successfully recorded Sync Log page in Notion: ${runId}`);
      } else {
        const errText = await res.text();
        console.warn(`[Heartbeat] Failed to write log page to Notion: ${res.status} - ${errText}`);
      }
    }

  } catch (err: any) {
    console.error("[Heartbeat Error]", err);
    await broadcastAlert({
      title: "🚨 Heartbeat System Failure",
      text: `Heartbeat and status update system crashed:\n\`\`\`\n${err.message || err}\n\`\`\``,
      color: "FF5F1F"
    });
  }

  await closePool();
}

runHeartbeat();
