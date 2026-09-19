import { logger } from "@stax/logger";
import express from "express";
import { Queue } from "bullmq";
import helmet from "helmet";
import cors from "cors";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { query, dbPool } from "./lib/db";
import { setupSearchIndex, meiliClient } from "./lib/meili";
import { normalizeUrl, generateUrlHash, isUrlDiscovered } from "./lib/dedupe";
import { resolveRedirectHash, logRedirectClick, ensureRedirectLink } from "./lib/redirect";
import { renderEdition } from "./lib/render-edition";
import crypto from "crypto";
import { Resend } from "resend";
import dotenv from "dotenv";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { broadcastAlert } from "./lib/notifications";
import { validate, errorHandler, requireAdminKey } from "@stax/api-middleware";
import { sanitize } from "./lib/sanitize";
import {
  subscribeSchema,
  submissionSchema,
  reactParamsSchema,
  reactBodySchema,
  senditParamsSchema,
  senditQuerySchema,
  boatVoteSchema,
  phrfCompareSchema,
  handicapEstimateSchema,
  fleetIntelSchema,
  userSubmissionSchema,
  createTribeSchema,
  createBulletinSchema,
  createReplySchema,
} from "./middleware/schemas";
import {
  scorePHRFToD,
  scorePHRFToT,
  getTimeAllowanceDiff,
  getTimeAllowanceDiffToT,
  estimateORCFromPHRF,
  estimateTCCFromPHRF,
} from "@stax/handicap-core";
import { buildActor, buildWebFinger, generateRSAKeyPair } from "@stax/activity-core";
import { ApiErrorResponse, ApiSuccessResponse } from "@almanac/types";
import { v1Router } from "./routes/v1";



dotenv.config();

export let analyticsClient: BetaAnalyticsDataClient | null = null;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_ANALYTICS_PROPERTY_ID) {
    analyticsClient = new BetaAnalyticsDataClient();
    logger.info("[GA4] Analytics client initialized successfully.");
  }
} catch (err) {
  logger.error("[GA4] Failed to initialize analytics client:", err);
}

process.on("uncaughtException", (error) => {
  logger.error("[Fatal uncaughtException]", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("[Fatal unhandledRejection]", reason);
});

import { Response } from "express";
export const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

app.use(cors({
  origin: (origin, callback) => {
    const allowed = (process.env.CORS_ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim());
    if (!origin || allowed.includes(origin)) return callback(null, true);
    callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
}));

// Legacy /api/* route re-writer for backwards compatibility
app.use((req, res, next) => {
  if (req.path.startsWith("/api/") && !req.path.startsWith("/api/v1/")) {
    let targetPath = req.path;
    if (targetPath.startsWith("/api/newsletter")) {
      targetPath = targetPath.replace("/api/newsletter", "/api/newsletters");
    }
    const newPath = targetPath.replace("/api/", "/api/v1/");
    logger.warn(`[Deprecated API] Rewriting ${req.path} to ${newPath}`);
    res.setHeader("Warning", `299 - "Deprecated API endpoint. Use ${newPath} instead"`);
    req.url = req.url.replace(req.path, newPath);
  }
  next();
});

app.use("/api/v1", v1Router);


function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
  res.status(statusCode).json({
    ...(data as any),
    data,
    statusCode,
  });
}

// Seeder Function: Reads data/languages.csv and inserts into DB if empty
async function seedLanguages() {
  try {
    // Check if languages table is empty
    const checkRes = await query("SELECT COUNT(*) FROM languages");
    const count = parseInt(checkRes.rows[0].count, 10);
    
    if (count > 0) {
      logger.info(`[Seeder] Languages table already has ${count} records. Skipping seeder.`);
      return;
    }

    const csvPath = path.join(process.cwd(), "../../data/languages.csv");
    if (!fs.existsSync(csvPath)) {
      logger.warn(`[Seeder Warning] Language CSV not found at: ${csvPath}`);
      return;
    }

    logger.info(`[Seeder] Seeding languages from ${csvPath}...`);
    const fileContent = fs.readFileSync(csvPath, "utf-8");
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    for (const record of records) {
      const language = record["Language"];
      const nativeName = record["Native name"];
      const suggestedTitle = record["Suggested title"];

      await query(
        "INSERT INTO languages (language_name, native_name, suggested_title) VALUES ($1, $2, $3)",
        [language, nativeName, suggestedTitle]
      );
    }
    
    logger.info(`[Seeder] Successfully seeded ${records.length} languages.`);
  } catch (error) {
    logger.error("[Seeder Error] Failed to seed languages:", error);
  }
}

// Startup Initialization
async function initializeServer() {
  logger.info("[Server Initialization] Starting...");
  
  // 1. Verify DB Connection
  try {
    const res = await query("SELECT NOW()");
    logger.info(`[Database] Connected successfully. Database time: ${res.rows[0].now}`);
  } catch (error) {
    logger.error("[Database Error] Failed to connect to Postgres. Make sure Docker container is running.", error);
  }

  // 2. Seed Languages
  await seedLanguages();

  // 3. Setup Search Indexes
  try {
    await setupSearchIndex("article_links", [
      "language",
      "moderation_state",
      "is_suppressed",
      "is_archived",
      "is_flagged",
      "domain",
      "source_family_id",
    ]);
    await setupSearchIndex("sailors", ["club_normalized", "state", "country"]);
    await setupSearchIndex("boats", ["design"]);
  } catch (error) {
    logger.error("[Search Index Error] Failed to connect to Meilisearch.", error);
  }
}

interface IngestItemResult {
  publishedAt: Date;
  dateSuspicious: boolean;
  dateSuspiciousReason: string;
}

export function processInoreaderItemDate(item: any, now: Date): IngestItemResult {
  const MAX_FUTURE_MS = 60 * 60 * 1000;
  const OLD_DATE_THRESHOLD_DAYS = 180;

  let publishedAt: Date;
  let dateSuspicious = false;
  let dateSuspiciousReason = "";

  if (item.published && typeof item.published === "number") {
    publishedAt = new Date(item.published * 1000);
  } else if (item.published) {
    publishedAt = new Date(item.published);
  } else {
    publishedAt = now;
    dateSuspicious = true;
    dateSuspiciousReason = "no_publish_date_in_feed";
  }

  const ageMs = now.getTime() - publishedAt.getTime();

  if (publishedAt.getTime() > now.getTime() + MAX_FUTURE_MS) {
    dateSuspicious = true;
    dateSuspiciousReason = "publish_date_in_future";
  } else if (ageMs > OLD_DATE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000) {
    dateSuspicious = true;
    dateSuspiciousReason = `publish_date_${Math.floor(ageMs / 86400000)}d_old`;
  }

  return { publishedAt, dateSuspicious, dateSuspiciousReason };
}

export async function dbInsertInoreaderItem(
  urlHash: string,
  cleanUrl: string,
  item: any,
  publishedAt: Date,
  dateSuspicious: boolean,
  dateSuspiciousReason: string
): Promise<void> {
  const metadata: Record<string, any> = {
    source: "inoreader_webhook",
  };
  if (dateSuspicious) {
    metadata.date_quality = { suspicious: true, reason: dateSuspiciousReason };
  }

  await query(
    `INSERT INTO article_links
      (url_hash, canonical_url, title, publisher_name, published_at, content_snippet, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (url_hash) DO NOTHING`,
    [
      urlHash,
      cleanUrl,
      item.title || "Untitled",
      item.origin?.title || null,
      publishedAt.toISOString(),
      item.summary?.content?.replace(/<[^>]+>/g, "").slice(0, 500) || null,
      JSON.stringify(metadata),
    ]
  );
}

export function processFeedlyItemDate(item: any, now: Date): IngestItemResult {
  const MAX_FUTURE_MS = 60 * 60 * 1000;
  const OLD_DATE_THRESHOLD_DAYS = 180;

  let publishedAt: Date;
  let dateSuspicious = false;
  let dateSuspiciousReason = "";

  if (item.published && typeof item.published === "number") {
    publishedAt = item.published > 1e10
      ? new Date(item.published)
      : new Date(item.published * 1000);
  } else {
    publishedAt = now;
    dateSuspicious = true;
    dateSuspiciousReason = "no_publish_date_in_feed";
  }

  const ageMs = now.getTime() - publishedAt.getTime();
  if (publishedAt.getTime() > now.getTime() + MAX_FUTURE_MS) {
    dateSuspicious = true;
    dateSuspiciousReason = "publish_date_in_future";
  } else if (ageMs > OLD_DATE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000) {
    dateSuspicious = true;
    dateSuspiciousReason = `publish_date_${Math.floor(ageMs / 86400000)}d_old`;
  }

  return { publishedAt, dateSuspicious, dateSuspiciousReason };
}

export async function dbInsertFeedlyItem(
  urlHash: string,
  cleanUrl: string,
  item: any,
  publishedAt: Date,
  dateSuspicious: boolean,
  dateSuspiciousReason: string,
  sourceType: string
): Promise<void> {
  const metadata: Record<string, any> = {
    source: "feedly_webhook",
    source_type: sourceType,
  };
  if (dateSuspicious) {
    metadata.date_quality = { suspicious: true, reason: dateSuspiciousReason };
  }

  const snippet = item.summary?.content
    ?.replace(/<[^>]+>/g, "")
    .slice(0, 500) || null;

  await query(
    `INSERT INTO article_links
      (url_hash, canonical_url, title, publisher_name, published_at, content_snippet, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (url_hash) DO NOTHING`,
    [
      urlHash,
      cleanUrl,
      item.title || "Untitled",
      item.origin?.title || null,
      publishedAt.toISOString(),
      snippet,
      JSON.stringify(metadata),
    ]
  );
}

async function fetchMeiliIndexedCount(): Promise<number> {
  try {
    const index = await meiliClient.getIndex("article_links");
    const stats = await index.getStats();
    return stats.numberOfDocuments;
  } catch {
    return 0;
  }
}

export async function fetchAdminStats() {
  const articles = await query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE is_suppressed = TRUE)::int AS suppressed,
      COUNT(*) FILTER (WHERE relevance_score > 0.7)::int AS relevance_high,
      COUNT(*) FILTER (WHERE relevance_score > 0.4 AND relevance_score <= 0.7)::int AS relevance_medium,
      COUNT(*) FILTER (WHERE relevance_score > 0.1 AND relevance_score <= 0.4)::int AS relevance_low,
      COUNT(*) FILTER (WHERE relevance_score <= 0.1)::int AS relevance_very_low,
      COUNT(*) FILTER (WHERE relevance_score IS NULL)::int AS relevance_null
    FROM article_links
  `);

  const feeds = await query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active,
      COUNT(*) FILTER (WHERE is_active = FALSE AND last_checked_at IS NOT NULL)::int AS dead,
      COUNT(*) FILTER (WHERE last_checked_at IS NULL)::int AS unvalidated
    FROM feed_endpoints
  `);

  const topDomains = await query(`
    SELECT domain, COUNT(*)::int AS count
    FROM article_links
    WHERE domain IS NOT NULL
    GROUP BY domain
    ORDER BY count DESC
    LIMIT 10
  `);

  const meiliIndexed = await fetchMeiliIndexedCount();

  return {
    article_links: {
      total: articles.rows[0].total,
      suppressed: articles.rows[0].suppressed,
      meilisearch_indexed_estimate: meiliIndexed,
      relevance_distribution: {
        high_gt_0_7: articles.rows[0].relevance_high,
        medium_0_4_to_0_7: articles.rows[0].relevance_medium,
        low_0_1_to_0_4: articles.rows[0].relevance_low,
        very_low_lte_0_1: articles.rows[0].relevance_very_low,
        null: articles.rows[0].relevance_null,
      },
      top_domains: topDomains.rows,
    },
    feed_endpoints: feeds.rows[0],
  };
}

export async function processArticleReaction(
  id: string,
  reaction: "up" | "down",
  sessionHash: string,
  prevReaction: string | null
) {
  await query(
    `INSERT INTO article_reactions (article_link_id, reaction, session_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (article_link_id, session_hash) DO UPDATE SET reaction = EXCLUDED.reaction`,
    [id, reaction, sessionHash]
  );

  let countUpdate = "";
  if (prevReaction === "up") {
    countUpdate = reaction === "down"
      ? "reaction_up_count = GREATEST(0, reaction_up_count - 1), reaction_down_count = reaction_down_count + 1"
      : "reaction_up_count = GREATEST(0, reaction_up_count - 1)";
  } else if (prevReaction === "down") {
    countUpdate = reaction === "up"
      ? "reaction_down_count = GREATEST(0, reaction_down_count - 1), reaction_up_count = reaction_up_count + 1"
      : "reaction_down_count = GREATEST(0, reaction_down_count - 1)";
  } else {
    countUpdate = reaction === "up" ? "reaction_up_count = reaction_up_count + 1" : "reaction_down_count = reaction_down_count + 1";
  }

  const updated = await query(
    `UPDATE article_links SET ${countUpdate} WHERE id = $1 RETURNING reaction_up_count, reaction_down_count`,
    [id]
  );

  return updated;
}

async function fetchFeedTelemetryStats() {
  const activeFeedsRes = await query("SELECT COUNT(*)::int FROM feed_endpoints WHERE is_active = true");
  const deadFeedsRes = await query("SELECT COUNT(*)::int FROM feed_endpoints WHERE is_active = false");
  const polledFeedsRes = await query(
    "SELECT COUNT(*)::int FROM feed_endpoints WHERE is_active = true AND last_polled_at > NOW() - INTERVAL '24 hours'"
  );
  return {
    activeFeedsCount: activeFeedsRes.rows[0].count,
    deadFeedsCount: deadFeedsRes.rows[0].count,
    polledFeedsCount: polledFeedsRes.rows[0].count,
  };
}

async function fetchArticleTelemetryStats() {
  const ingestedRes = await query(
    "SELECT COUNT(*)::int FROM article_links WHERE created_at > NOW() - INTERVAL '24 hours'"
  );
  const scoredRes = await query(
    "SELECT COUNT(*)::int FROM article_links WHERE relevance_checked_at > NOW() - INTERVAL '24 hours' AND relevance_score IS NOT NULL"
  );
  const pendingRes = await query(
    "SELECT COUNT(*)::int FROM article_links WHERE relevance_score IS NULL AND is_suppressed = false"
  );
  const critiquesRes = await query(
    "SELECT COUNT(*)::int FROM article_links WHERE metadata->>'critique_processed' = 'true' AND relevance_checked_at > NOW() - INTERVAL '24 hours'"
  );
  return {
    ingestedCount: ingestedRes.rows[0].count,
    scoredCount: scoredRes.rows[0].count,
    pendingCount: pendingRes.rows[0].count,
    critiquesCount: critiquesRes.rows[0].count,
  };
}

async function fetchOtherTelemetryStats() {
  const newsletterRes = await query(
    "SELECT title, created_at FROM newsletters WHERE created_at > NOW() - INTERVAL '24 hours' ORDER BY created_at DESC LIMIT 1"
  );
  const newsletterSent = (newsletterRes.rowCount && newsletterRes.rowCount > 0) ? newsletterRes.rows[0].title : "None";

  const subscribersRes = await query(
    "SELECT COUNT(*)::int FROM subscribers WHERE created_at > NOW() - INTERVAL '24 hours'"
  );

  const redirectRes = await query(
    "SELECT COUNT(*)::int FROM redirect_clicks WHERE clicked_at > NOW() - INTERVAL '24 hours'"
  ).catch((err) => {
    logger.error("[Heartbeat Telemetry] Failed to query redirect_clicks:", err);
    return { rows: [{ count: 0 }] };
  });

  const dqLowRes = await query(
    "SELECT COUNT(*)::int FROM article_links WHERE dq_score IS NOT NULL AND dq_score < 0.5"
  ).catch((err) => {
    logger.error("[Heartbeat Telemetry] Failed to query low-quality articles:", err);
    return { rows: [{ count: 0 }] };
  });

  const ogMissingRes = await query(
    "SELECT COUNT(*)::int FROM article_links WHERE og_image_url IS NULL AND is_suppressed = false AND relevance_score >= 0.4"
  ).catch((err) => {
    logger.error("[Heartbeat Telemetry] Failed to query missing OG images:", err);
    return { rows: [{ count: 0 }] };
  });

  return {
    newsletterSent,
    subscribersCount: subscribersRes.rows[0].count,
    redirectCount: redirectRes.rows[0].count,
    dqLowCount: dqLowRes.rows[0].count,
    ogMissingCount: ogMissingRes.rows[0].count,
  };
}

export async function fetchHeartbeatTelemetry() {
  const feedStats = await fetchFeedTelemetryStats();
  const articleStats = await fetchArticleTelemetryStats();
  const otherStats = await fetchOtherTelemetryStats();

  let recommendations = "🟢 Crawlers are fully matching load. Performance looks optimal.";
  if (feedStats.activeFeedsCount > feedStats.polledFeedsCount) {
    recommendations = `⚠️ ALERT: ${feedStats.activeFeedsCount - feedStats.polledFeedsCount} active feeds have not been polled in the last 24h. Check ingest worker status.`;
  } else if (articleStats.ingestedCount === 0) {
    recommendations = "⚠️ WARNING: 0 new articles ingested in the last 24h. Feeds might be silent.";
  } else if (articleStats.pendingCount > 300) {
    recommendations = `⚠️ BACKLOG: ${articleStats.pendingCount} articles pending relevance scoring. Recommend scaling relevance cron loops.`;
  }

  return {
    timestamp: new Date().toISOString(),
    stats: {
      active_feeds: feedStats.activeFeedsCount,
      dead_feeds: feedStats.deadFeedsCount,
      feeds_polled_24h: feedStats.polledFeedsCount,
      articles_ingested_24h: articleStats.ingestedCount,
      articles_scored_24h: articleStats.scoredCount,
      unscored_backlog: articleStats.pendingCount,
      critiques_handled_24h: articleStats.critiquesCount,
      subscribers_joined_24h: otherStats.subscribersCount,
      latest_newsletter_24h: otherStats.newsletterSent,
      redirect_clicks_24h: otherStats.redirectCount,
      dq_low_quality_articles: otherStats.dqLowCount,
      og_image_missing_relevant: otherStats.ogMissingCount,
    },
    recommendations,
  };
}

function buildEntitiesFilterQuery(queryParams: any) {
  const typeFilter = queryParams.type as string | undefined;
  const verifiedFilter = queryParams.verified as string | undefined;
  const q = (queryParams.q as string)?.trim();

  const conditions: string[] = [];
  const params: (string | boolean | number)[] = [];
  let p = 1;

  if (typeFilter) {
    conditions.push(`et.slug = $${p}`);
    params.push(typeFilter); p++;
  }
  if (verifiedFilter === "true" || verifiedFilter === "false") {
    conditions.push(`e.is_verified = $${p}`);
    params.push(verifiedFilter === "true"); p++;
  }
  if (q) {
    conditions.push(`(e.canonical_name ILIKE $${p} OR e.slug ILIKE $${p})`);
    params.push(`%${q}%`); p++;
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  return { where, params, nextParamIndex: p };
}

export async function fetchEntities(queryParams: any) {
  const page = parseInt((queryParams.page as string) || "1");
  const limit = Math.min(parseInt((queryParams.limit as string) || "50"), 100);
  const offset = (page - 1) * limit;

  const { where, params, nextParamIndex } = buildEntitiesFilterQuery(queryParams);
  params.push(limit, offset);

  const rows = await query(
    `SELECT e.id, e.slug, e.canonical_name, e.aliases, e.description,
            e.dominant_color, e.is_verified, e.metadata,
            et.slug AS entity_type, et.label AS entity_type_label,
            COUNT(em.id)::int AS mention_count
     FROM entities e
     JOIN entity_types et ON et.id = e.entity_type_id
     LEFT JOIN entity_mentions em ON em.entity_id = e.id
     ${where}
     GROUP BY e.id, et.slug, et.label
     ORDER BY mention_count DESC, e.canonical_name ASC
     LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}`,
    params
  );
  const total = await query(
    `SELECT COUNT(*)::int FROM entities e JOIN entity_types et ON et.id = e.entity_type_id ${where}`,
    params.slice(0, -2)
  );

  return {
    entities: rows.rows,
    total: total.rows[0].count,
    page,
    limit,
  };
}

export function buildEntityRss(entity: any, articles: any[]): string {
  const apiBase = process.env.API_BASE_URL ?? "https://api.sailsouthern.com";
  const webBase = process.env.WEB_BASE_URL ?? "https://sailsouthern.com";
  const escXml = (s: string) => s?.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;") ?? "";

  let rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n`;
  rss += `    <title>${escXml(entity.canonical_name)} — Sail Southern</title>\n`;
  rss += `    <link>${escXml(webBase)}/entities/${escXml(entity.slug)}</link>\n`;
  rss += `    <description>${escXml(entity.description ?? `Articles mentioning ${entity.canonical_name}`)}</description>\n`;
  rss += `    <atom:link href="${escXml(apiBase)}/api/entities/${escXml(entity.slug)}/feed.rss" rel="self" type="application/rss+xml"/>\n`;

  for (const a of articles) {
    const link = a.redirect_hash
      ? `${apiBase}/sendit/${a.redirect_hash}?src=rss`
      : a.canonical_url;
    rss += `    <item>\n`;
    rss += `      <title>${escXml(a.title ?? "Untitled")}</title>\n`;
    rss += `      <link>${escXml(link)}</link>\n`;
    rss += `      <description>${escXml((a.content_snippet ?? "").slice(0, 300))}</description>\n`;
    rss += `      <pubDate>${new Date(a.published_at).toUTCString()}</pubDate>\n`;
    rss += `      <source>${escXml(a.publisher_name ?? "")}</source>\n`;
    rss += `    </item>\n`;
  }
  rss += `  </channel>\n</rss>`;
  return rss;
}

export function buildCombinedRss(title: string, entitySlugs: string[], articles: any[]): string {
  const apiBase = process.env.API_BASE_URL ?? "https://api.sailsouthern.com";
  const escXml = (s: string) => s?.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;") ?? "";

  let rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n`;
  rss += `    <title>${escXml(title)} — Sail Southern Custom Feed</title>\n`;
  rss += `    <link>https://sailsouthern.com/builder</link>\n`;
  rss += `    <description>Custom combined feed for ${escXml(entitySlugs.join(", "))}</description>\n`;

  for (const a of articles) {
    const link = a.redirect_hash
      ? `${apiBase}/sendit/${a.redirect_hash}?src=rss`
      : a.canonical_url;
    rss += `    <item>\n`;
    rss += `      <title>${escXml(a.title ?? "Untitled")}</title>\n`;
    rss += `      <link>${escXml(link)}</link>\n`;
    rss += `      <description>${escXml((a.content_snippet ?? "").slice(0, 300))}</description>\n`;
    rss += `      <pubDate>${new Date(a.published_at).toUTCString()}</pubDate>\n`;
    rss += `    </item>\n`;
  }
  rss += `  </channel>\n</rss>`;
  return rss;
}

async function fetchGA4TopPages(propertyId: string) {
  if (!analyticsClient) throw new Error("Analytics client not initialized");
  const [pagesResponse] = await analyticsClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "sessions" }],
    limit: 10,
  });
  return (pagesResponse.rows || []).map((row: any) => ({
    page: row.dimensionValues?.[0]?.value || "/",
    sessions: parseInt(row.metricValues?.[0]?.value || "0", 10),
  }));
}

async function fetchGA4Totals(propertyId: string) {
  if (!analyticsClient) throw new Error("Analytics client not initialized");
  const [totalsResponse] = await analyticsClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [
      { startDate: "7daysAgo", endDate: "today" },
      { startDate: "15daysAgo", endDate: "8daysAgo" },
    ],
    metrics: [
      { name: "sessions" },
      { name: "activeUsers" },
      { name: "screenPageViews" },
    ],
  });
  const currentTotals = totalsResponse.rows?.[0] || {};
  const priorTotals = totalsResponse.rows?.[1] || {};

  const currentSessions = parseInt(currentTotals.metricValues?.[0]?.value || "0", 10);
  const priorSessions = parseInt(priorTotals.metricValues?.[0]?.value || "0", 10);
  const sessionsDelta = priorSessions ? ((currentSessions - priorSessions) / priorSessions) * 100 : 0;

  const currentUsers = parseInt(currentTotals.metricValues?.[1]?.value || "0", 10);
  const priorUsers = parseInt(priorTotals.metricValues?.[1]?.value || "0", 10);
  const usersDelta = priorUsers ? ((currentUsers - priorUsers) / priorUsers) * 100 : 0;

  const currentViews = parseInt(currentTotals.metricValues?.[2]?.value || "0", 10);
  const priorViews = parseInt(priorTotals.metricValues?.[2]?.value || "0", 10);
  const viewsDelta = priorViews ? ((currentViews - priorViews) / priorViews) * 100 : 0;

  return {
    sessions: { current: currentSessions, prior: priorSessions, delta_pct: sessionsDelta },
    users: { current: currentUsers, prior: priorUsers, delta_pct: usersDelta },
    pageviews: { current: currentViews, prior: priorViews, delta_pct: viewsDelta },
  };
}

async function fetchGA4Redirects(propertyId: string) {
  if (!analyticsClient) throw new Error("Analytics client not initialized");
  const [clicksResponse] = await analyticsClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "pagePath",
        stringFilter: {
          matchType: "BEGINS_WITH",
          value: "/sendit/",
        },
      },
    },
    limit: 10,
  });
  return (clicksResponse.rows || []).map((row: any) => ({
    hash: (row.dimensionValues?.[0]?.value || "").replace("/sendit/", ""),
    clicks: parseInt(row.metricValues?.[0]?.value || "0", 10),
  }));
}

export async function fetchGA4Report(propertyId: string) {
  const topPages = await fetchGA4TopPages(propertyId);
  const metrics = await fetchGA4Totals(propertyId);
  const topRedirects = await fetchGA4Redirects(propertyId);
  return { topPages, metrics, topRedirects };
}

// ─── /health ─────────────────────────────────────────────────────────────────
app.get("/health", async (_req, res) => {
  let dbStatus: "ok" | "error" = "ok";
  let searchStatus: "ok" | "error" = "ok";
  try { await query("SELECT 1"); } catch { dbStatus = "error"; }
  try {
    const meiliUrl = process.env.MEILI_HTTP_ADDR || "http://localhost:7700";
    const r = await fetch(`${meiliUrl}/health`, { signal: AbortSignal.timeout(2000) });
    if (!r.ok) searchStatus = "error";
  } catch { searchStatus = "error"; }
  res.status(dbStatus === "ok" ? 200 : 503).json({
    status: dbStatus === "ok" && searchStatus === "ok" ? "ok" : "degraded",
    db: dbStatus,
    search: searchStatus,
    timestamp: new Date().toISOString(),
  });
});

// ─── /sendit/:hash — Outbound Redirect ───────────────────────────────────────
// LINK DOCTRINE: All outbound article links use /sendit/<hash>.
// OG images served direct from source URL — no redirect.
//
// Rate limit: 20 req / IP / min (in-memory sliding window).
// Logs a redirect_click row + increments click_count — both fire-and-forget.
const sendItRateBuckets = new Map<string, number[]>();
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [ip, times] of sendItRateBuckets) {
    const filtered = times.filter(t => t > cutoff);
    if (filtered.length === 0) sendItRateBuckets.delete(ip);
    else sendItRateBuckets.set(ip, filtered);
  }
}, 30_000).unref();

app.get(
  "/sendit/:hash",
  validate(senditParamsSchema, "params"),
  validate(senditQuerySchema, "query"),
  async (req, res, next) => {
    const ip = req.ip || "unknown";
    const now = Date.now();
    const bucket = sendItRateBuckets.get(ip) ?? [];
    const recent = bucket.filter(t => t > now - 60_000);
    if (recent.length >= 20) {
      return res.status(429).json({
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests",
          details: null
        }
      } satisfies ApiErrorResponse);
    }
    sendItRateBuckets.set(ip, [...recent, now]);

    const { hash } = req.params;
    try {
      const result = await resolveRedirectHash(hash);
      if (!result) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Link not found",
            details: null
          }
        } satisfies ApiErrorResponse);
      }

      const srcMap: Record<string, string> = {
        nl: "newsletter", ed: "email_daily", ew: "email_weekly", rss: "rss"
      };
      const source = srcMap[(req.query.src as string) ?? ""] ?? "web";

      logRedirectClick({
        articleLinkId: result.articleLinkId,
        hash,
        source,
        subscriberId: req.query.sid ? parseInt(req.query.sid as string, 10) : null,
        utmMedium: (req.query.utm_medium as string) ?? null,
        ipRaw: req.ip ?? null,
        referrer: req.headers.referer ?? null,
      });

      return res.redirect(302, result.canonicalUrl);
    } catch (err: any) {
      next(err);
    }
  }
);

// ─── POST /api/articles/:id/react ─────────────────────────────────────────────
app.post(
  "/api/articles/:id/react",
  validate(reactParamsSchema, "params"),
  validate(reactBodySchema, "body"),
  async (req, res, next) => {
    const { id } = req.params;
    const { reaction } = req.body;

    const cookieHeader = req.headers.cookie ?? "";
    const cookieMap = Object.fromEntries(
      cookieHeader.split(";").map(c => c.trim().split("=")).filter(p => p.length === 2)
    );
    let sessionValue: string = cookieMap["ss_session"] ?? "";
    let setCookie = false;
    if (!sessionValue) {
      sessionValue = crypto.randomBytes(24).toString("hex");
      setCookie = true;
    }
    const sessionHash = crypto.createHash("sha256").update(sessionValue).digest("hex");

    try {
      const existing = await query(
        `SELECT reaction FROM article_reactions WHERE article_link_id = $1 AND session_hash = $2`,
        [id, sessionHash]
      );
      const prevReaction: string | null = existing.rows[0]?.reaction ?? null;

      if (prevReaction === reaction) {
        const counts = await query(
          `SELECT reaction_up_count, reaction_down_count FROM article_links WHERE id = $1`,
          [id]
        );
        if (setCookie) res.setHeader("Set-Cookie", `ss_session=${sessionValue}; HttpOnly; Max-Age=${365*24*3600}; Path=/; SameSite=Lax`);
        return sendSuccess(res, {
          reaction,
          up_count: counts.rows[0]?.reaction_up_count ?? 0,
          down_count: counts.rows[0]?.reaction_down_count ?? 0
        });
      }

      const updated = await processArticleReaction(id, reaction, sessionHash, prevReaction);
      if (updated.rowCount === 0) {
        return res.status(404).json({
          error: "Article not found",
          code: "NOT_FOUND",
          statusCode: 404
        } satisfies ApiErrorResponse);
      }

      if (setCookie) res.setHeader("Set-Cookie", `ss_session=${sessionValue}; HttpOnly; Max-Age=${365*24*3600}; Path=/; SameSite=Lax`);
      return sendSuccess(res, {
        reaction,
        up_count: updated.rows[0].reaction_up_count,
        down_count: updated.rows[0].reaction_down_count,
      });
    } catch (err: any) {
      next(err);
    }
  }
);

// GET /.well-known/webfinger — WebFinger actor discovery
app.get("/.well-known/webfinger", async (req, res, next) => {
  try {
    const resource = req.query.resource as string;
    if (!resource || !resource.startsWith("acct:")) {
      return res.status(400).json({ error: "Missing or invalid resource parameter" });
    }

    const acct = resource.substring(5); // Strip "acct:"
    const parts = acct.split("@");
    if (parts.length !== 2) {
      return res.status(400).json({ error: "Invalid acct URI format" });
    }
    const [username, queryDomain] = parts;

    let targetDomain = queryDomain;
    if (queryDomain === "localhost" || queryDomain === "127.0.0.1") {
      targetDomain = req.headers.host || `${req.hostname}:${port}`;
    }

    let isValidActor = false;
    let resolvedSlug = username;

    if (username === "almanac" || username === "sailsouthern" || username === "sailingalmanac") {
      const mastodonUser = username === "sailingalmanac" ? "almanac" : username;
      const socialDomain = "social.sailingalmanac.org";
      const links = [
        {
          rel: "http://webfinger.net/rel/profile-page",
          type: "text/html",
          href: `https://${socialDomain}/@${mastodonUser}`
        },
        {
          rel: "self",
          type: "application/activity+json",
          href: `https://${socialDomain}/users/${mastodonUser}`
        }
      ];
      res.setHeader("Content-Type", "application/jrd+json");
      return res.status(200).json({
        subject: `acct:${username}@${queryDomain}`,
        aliases: [
          `https://${socialDomain}/@${mastodonUser}`,
          `https://${socialDomain}/users/${mastodonUser}`
        ],
        links
      });
    }

    const entityRes = await query("SELECT slug FROM entities WHERE slug = $1", [username]);
    const tribeRes = await query("SELECT slug FROM tribes WHERE slug = $1", [username]);
    if (entityRes.rows[0] || tribeRes.rows[0]) {
      isValidActor = true;
      resolvedSlug = entityRes.rows[0]?.slug || tribeRes.rows[0]?.slug;
    }

    if (!isValidActor) {
      return res.status(404).json({ error: "Actor not found" });
    }

    const actorId = `https://${targetDomain}/api/v1/entities/${resolvedSlug}/actor`;
    const keysRes = await query("SELECT lightning_address FROM actor_keys WHERE actor_id = $1", [actorId]);
    const lightningAddress = keysRes.rows[0]?.lightning_address;

    const links: any[] = [
      {
        rel: "self",
        type: "application/activity+json",
        href: actorId
      }
    ];

    if (lightningAddress) {
      links.push({
        rel: "lnurlp",
        type: "application/lightning-integration",
        href: `lightning:${lightningAddress}`
      });
    }

    res.setHeader("Content-Type", "application/jrd+json");
    res.status(200).json({
      subject: `acct:${resolvedSlug}@${queryDomain}`,
      links
    });
  } catch (err: any) {
    next(err);
  }
});

// Outbound ActivityPub delivery queue helpers
const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

const apOutboundQueue = new Queue("activitypub-outbound", {
  connection: redisConnection,
});

async function queueOutboundActivity(actorId: string, inboxUrl: string, activity: any) {
  try {
    await apOutboundQueue.add("deliver", { actorId, inboxUrl, activity });
    logger.info(`[ActivityPub Queue] Enqueued outbound activity to ${inboxUrl}`);
  } catch (err) {
    logger.error(`[ActivityPub Queue] Failed to enqueue outbound activity to ${inboxUrl}:`, err);
  }
}

// WebSub / PubSubHubbub Publisher Helper
export async function pingWebSubHub(feedUrl: string) {
  const hubUrl = process.env.WEBSUB_HUB_URL || "https://pubsubhubbub.appspot.com/";
  try {
    const res = await fetch(hubUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        "hub.mode": "publish",
        "hub.url": feedUrl
      })
    });
    logger.info(`[WebSub] Pinged hub for ${feedUrl}. Status: ${res.status}`);
  } catch (err) {
    logger.error(`[WebSub] Failed to ping WebSub hub for ${feedUrl}:`, err);
  }
}

// Wayback Save Page Now Helper
const waybackQueue = new Queue("wayback-spn", {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
  }
});

export async function triggerSavePageNow(url: string) {
  try {
    await waybackQueue.add("archive", { url }, {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 5000,
      }
    });
    logger.info(`[Wayback Queue] Enqueued archive task for ${url}`);
  } catch (err) {
    logger.error(`[Wayback Queue] Failed to enqueue archive task for ${url}:`, err);
  }
}

// Selective Interaction Rule Helper
export async function isDiscussionEnabledForEntity(slug: string): Promise<boolean> {
  const tribeRes = await query("SELECT id FROM tribes WHERE slug = $1", [slug]);
  if (tribeRes.rows.length > 0) return true;

  const entityRes = await query("SELECT metadata FROM entities WHERE slug = $1", [slug]);
  if (entityRes.rows[0]) {
    const meta = entityRes.rows[0].metadata || {};
    return meta.discussion_enabled === true || meta.discussion_enabled === "true";
  }
  return false;
}

// In-Memory Rate Limiting
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(options: { windowMs: number; max: number }) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = (req.ip || req.socket.remoteAddress || "unknown").toString();
    const now = Date.now();
    const limit = rateLimits.get(ip);

    if (!limit || now > limit.resetAt) {
      rateLimits.set(ip, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    if (limit.count >= options.max) {
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
        code: "TOO_MANY_REQUESTS",
        statusCode: 429
      } satisfies ApiErrorResponse);
    }

    limit.count++;
    next();
  };
}

app.use(errorHandler);



// Start Server
if (process.env.NODE_ENV !== "test") {
  app.listen(port, async () => {
    logger.info(`[Server] API running at http://localhost:${port}`);
    await initializeServer();
  });
}


