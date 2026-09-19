import dotenv from "dotenv";
import { Pool } from "pg";
import { logger } from "@stax/logger";
import { sendGA4Event } from "@stax/activity-core";

dotenv.config();

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchMastodonMetrics(statusId: string): Promise<{ likes: number; shares: number; replies: number } | null> {
  const instanceUrl = process.env.MASTODON_INSTANCE_URL;
  const accessToken = process.env.MASTODON_ACCESS_TOKEN;

  if (!instanceUrl) {
    logger.warn("[MetricsWorker] Mastodon instance URL is not configured. Skipping Mastodon metrics.");
    return null;
  }

  const endpoint = `${instanceUrl.replace(/\/$/, "")}/api/v1/statuses/${statusId}`;
  const headers: Record<string, string> = {
    "Accept": "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    const res = await fetch(endpoint, { headers });
    if (!res.ok) {
      if (res.status === 404) {
        logger.warn(`[MetricsWorker] Mastodon status ${statusId} not found (404).`);
        return null;
      }
      throw new Error(`Mastodon API returned status ${res.status}`);
    }
    const data = await res.json();
    return {
      likes: data.favourites_count || 0,
      shares: data.reblogs_count || 0,
      replies: data.replies_count || 0,
    };
  } catch (err: any) {
    logger.error(`[MetricsWorker] Failed to fetch Mastodon metrics for status ${statusId}:`, err.message || String(err));
    return null;
  }
}

async function fetchBlueskyMetrics(postUri: string): Promise<{ likes: number; shares: number; replies: number } | null> {
  // postUri is at://did:plc:xxx/app.bsky.feed.post/yyy
  const endpoint = `https://bsky.social/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(postUri)}`;

  try {
    const res = await fetch(endpoint, {
      headers: { "Accept": "application/json" }
    });
    if (!res.ok) {
      if (res.status === 404) {
        logger.warn(`[MetricsWorker] Bluesky post thread not found for URI ${postUri}`);
        return null;
      }
      throw new Error(`Bluesky API returned status ${res.status}`);
    }
    const data = await res.json();
    const post = data.thread?.post;
    if (!post) {
      logger.warn(`[MetricsWorker] No post view returned in thread response for ${postUri}`);
      return null;
    }
    return {
      likes: post.likeCount || 0,
      shares: post.repostCount || 0,
      replies: post.replyCount || 0,
    };
  } catch (err: any) {
    logger.error(`[MetricsWorker] Failed to fetch Bluesky metrics for ${postUri}:`, err.message || String(err));
    return null;
  }
}

export async function captureOutboundSocialMetrics() {
  logger.info("[MetricsWorker] Starting outbound social metrics collection tick...");
  try {
    // Query active deliveries in the last 7 days
    const deliveriesRes = await dbPool.query(`
      SELECT id, post_id, platform, external_id, external_url
      FROM social_post_deliveries
      WHERE status = 'success'
        AND platform IN ('mastodon', 'bluesky')
        AND external_id IS NOT NULL
        AND external_id <> ''
        AND delivered_at > NOW() - INTERVAL '7 days'
      ORDER BY delivered_at DESC
    `);

    const deliveries = deliveriesRes.rows;
    logger.info(`[MetricsWorker] Found ${deliveries.length} recent deliveries to fetch metrics for.`);

    for (const delivery of deliveries) {
      let metrics: { likes: number; shares: number; replies: number } | null = null;

      if (delivery.platform === "mastodon") {
        metrics = await fetchMastodonMetrics(delivery.external_id);
      } else if (delivery.platform === "bluesky") {
        metrics = await fetchBlueskyMetrics(delivery.external_id);
      }

      if (metrics) {
        // Append snapshot
        await dbPool.query(`
          INSERT INTO social_post_metrics_snapshots (post_id, delivery_id, likes_count, shares_count, replies_count, impressions_count)
          VALUES ($1, $2, $3, $4, $5, 0)
        `, [delivery.post_id, delivery.id, metrics.likes, metrics.shares, metrics.replies]);
        
        logger.info(`[MetricsWorker] Saved metrics snapshot for delivery ${delivery.id} (${delivery.platform}): likes=${metrics.likes}, shares=${metrics.shares}, replies=${metrics.replies}`);

        // Emit server-side GA4 Event for metrics snapshot
        await sendGA4Event("social_metrics_snapshot", {
          platform: delivery.platform,
          post_id: delivery.post_id,
          delivery_id: delivery.id,
          likes: metrics.likes,
          shares: metrics.shares,
          replies: metrics.replies
        });
      }

      // Throttle request rate
      await sleep(1000);
    }
    logger.info("[MetricsWorker] Completed outbound social metrics collection tick.");
  } catch (err) {
    logger.error("[MetricsWorker] Error capturing outbound metrics:", err);
  }
}

// Scheduled daemon loop
export function startMetricsWorkerDaemon() {
  logger.info("[MetricsWorker] Starting metrics collection daemon loop...");
  const intervalMs = 60 * 60 * 1000; // Wakes up every 1 hour
  
  const tick = async () => {
    await captureOutboundSocialMetrics();
    setTimeout(tick, intervalMs);
  };
  
  tick();
}

// Start if executed directly
if (require.main === module) {
  captureOutboundSocialMetrics().then(() => process.exit(0));
}
