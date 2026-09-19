import { logger } from "@stax/logger";
import Parser from "rss-parser";
import { Pool } from "pg";
import dotenv from "dotenv";
import { normalizeUrl, generateUrlHash, isUrlDiscovered } from "./dedupe";
import { broadcastAlert } from "./lib/notifications";
import { entityExtractionQueue } from "./entity-extractor";

/**
 * A4 (live): After a new article is inserted, fire-and-forget attempt to
 * extract the og:image meta tag from the article page.
 * LINK DOCTRINE: OG images served direct from source URL — no redirect.
 * 3-second hard timeout; max 32 KB read; never blocks the poll cycle.
 */
async function fetchOgImage(url: string, articleId: string, db: import('pg').Pool): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "SailSouthernBot/1.0 (+https://sailsouthern.com/bot)", Accept: "text/html" },
    });
    if (!resp.ok) return;
    const reader = resp.body?.getReader();
    if (!reader) return;
    let chunk = "";
    let bytes = 0;
    while (bytes < 32_768) {
      const { done, value } = await reader.read();
      if (done) break;
      chunk += new TextDecoder().decode(value);
      bytes += value.byteLength;
      if (chunk.includes("</head>") || chunk.includes("<body")) break;
    }
    reader.cancel();
    const m =
      chunk.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      chunk.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const ogUrl = m?.[1]?.trim();
    if (ogUrl?.startsWith("http")) {
      await db.query(
        `UPDATE article_links SET og_image_url = $1, og_image_scraped_at = NOW() WHERE id = $2`,
        [ogUrl, articleId]
      );
    }
  } catch {
    // Non-blocking — swallow all errors
  } finally {
    clearTimeout(timer);
  }
}

dotenv.config();

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const parser = new Parser({
  customFields: {
    item: [
      ["enclosure", "enclosure"],
      ["itunes:duration", "itunesDuration"],
      ["itunes:episode", "itunesEpisode"],
      ["itunes:season", "itunesSeason"],
    ],
  },
});

async function processFeedItem(
  item: Parser.Item,
  feedTitle: string,
  endpointUrl: string,
  endpointId: string
): Promise<{ isNew: boolean; isPodcast: boolean }> {
  if (!item.link) return { isNew: false, isPodcast: false };

  const cleanUrl = await normalizeUrl(item.link);
  const urlHash = generateUrlHash(cleanUrl);

  if (await isUrlDiscovered(urlHash)) return { isNew: false, isPodcast: false };

  const isPodcast =
    !!item.enclosure &&
    (item.enclosure as any).type?.startsWith("audio/");

  const metadata = isPodcast
    ? {
        article_type: "podcast",
        media_enclosure: item.enclosure,
        podcast_metadata: {
          duration: (item as any).itunesDuration,
          episode: (item as any).itunesEpisode,
          season: (item as any).itunesSeason,
          show_title: feedTitle,
        },
      }
    : {};

  const insertResult = await dbPool.query<{ id: string }>(
    `INSERT INTO article_links
      (url_hash, canonical_url, title, publisher_name, published_at, metadata, content_snippet, intake_source, processing_lane)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 'feed', 'current')
     ON CONFLICT (url_hash) DO NOTHING
     RETURNING id`,
    [
      urlHash,
      cleanUrl,
      item.title || "Untitled",
      feedTitle || new URL(endpointUrl).hostname,
      item.isoDate || item.pubDate || new Date().toISOString(),
      JSON.stringify(metadata),
      item.contentSnippet?.slice(0, 500) || null,
    ]
  );

  if (insertResult.rows[0]?.id && !isPodcast) {
    const articleId = insertResult.rows[0].id;
    fetchOgImage(cleanUrl, articleId, dbPool).catch(() => {});
    entityExtractionQueue.add("extract-entities", { articleId }).catch((err) => {
      logger.error(`[Feed Poller] Failed to enqueue entity extraction for article ${articleId}:`, err);
    });
  }

  await dbPool.query(
    "UPDATE feed_endpoints SET last_polled_at = NOW() WHERE id = $1",
    [endpointId]
  );

  logger.info(`[Feed Poller] Saved ${isPodcast ? "🎙 podcast" : "📰 article"}: ${item.title}`);
  return { isNew: true, isPodcast };
}

async function pollSingleEndpoint(
  endpoint: { id: string; url: string },
  failedFeeds: string[]
): Promise<{ newArticles: number; newPodcasts: number }> {
  let newArticles = 0;
  let newPodcasts = 0;
  logger.info(`[Feed Poller] Polling ${endpoint.url}`);
  try {
    const feed = await parser.parseURL(endpoint.url);
    for (const item of feed.items) {
      const res = await processFeedItem(item, feed.title || "", endpoint.url, endpoint.id);
      if (res.isNew) {
        if (res.isPodcast) newPodcasts++;
        else newArticles++;
      }
    }
  } catch (err: any) {
    logger.error(`[Feed Poller] Failed to parse feed ${endpoint.url}: ${err.message}`);
    failedFeeds.push(`${endpoint.url} (${err.message})`);
  }
  return { newArticles, newPodcasts };
}

async function sendIngestionReport(
  endpointsCount: number,
  newArticles: number,
  newPodcasts: number,
  failedFeeds: string[]
): Promise<void> {
  await broadcastAlert({
    title: "📰 Ingestion Poller Heartbeat",
    text: `Completed feed polling cycle.`,
    fields: [
      { name: "Active Feeds Polled", value: `${endpointsCount}`, inline: true },
      { name: "New Articles Discovered", value: `${newArticles}`, inline: true },
      { name: "New Podcasts Discovered", value: `${newPodcasts}`, inline: true },
      { name: "Feed Status Errors", value: failedFeeds.length > 0 ? `${failedFeeds.length} failed` : "None", inline: true },
      { name: "Failed Feeds List", value: failedFeeds.length > 0 ? failedFeeds.slice(0, 5).join("\n") : "All feeds parsed successfully.", inline: false }
    ],
    color: failedFeeds.length > 0 ? "FF5F1F" : "39FF14"
  });
}

export async function pollFeeds() {
  logger.info("[Feed Poller] Starting feed polling cycle...");
  let newArticlesCount = 0;
  let newPodcastsCount = 0;
  const failedFeeds: string[] = [];

  try {
    const res = await dbPool.query(
      "SELECT id, url FROM feed_endpoints WHERE is_active = true"
    );
    const endpoints = res.rows;
    logger.info(`[Feed Poller] Found ${endpoints.length} active feed endpoints`);

    for (const endpoint of endpoints) {
      const stats = await pollSingleEndpoint(endpoint, failedFeeds);
      newArticlesCount += stats.newArticles;
      newPodcastsCount += stats.newPodcasts;
    }

    logger.info("[Feed Poller] Polling cycle complete.");
    await sendIngestionReport(endpoints.length, newArticlesCount, newPodcastsCount, failedFeeds);

  } catch (err: any) {
    logger.error("[Feed Poller Error]", err);
    await broadcastAlert({
      title: "🚨 Ingestion Poller CRITICAL FAILURE",
      text: `Ingest poller encountered a fatal exception:\n\`\`\`\n${err.message || err}\n\`\`\``,
      color: "FF5F1F"
    });
  }
}

// If run directly: npx tsx workers/ingest/src/feed-poller.ts
if (require.main === module) {
  pollFeeds().then(() => process.exit(0));
}
