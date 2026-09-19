import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import Redis from "ioredis";
import { Resend } from "resend";
import { query } from "../lib/db";
import { meiliClient } from "../lib/meili";
import { normalizeUrl, generateUrlHash, isUrlDiscovered } from "../lib/dedupe";
import { resolveRedirectHash, logRedirectClick } from "../lib/redirect";
import { renderEdition } from "../lib/render-edition";
import { sanitize } from "../lib/sanitize";
import { logger } from "@stax/logger";
import { validate, requireAdminKey } from "@stax/api-middleware";
import { Queue } from "bullmq";
import { ApiErrorResponse } from "@almanac/types";
import {
  subscribeSchema,
  boatVoteSchema,
  phrfCompareSchema,
  handicapEstimateSchema,
  fleetIntelSchema,
  userSubmissionSchema,
  createTribeSchema,
  createBulletinSchema,
  createReplySchema,
} from "../middleware/schemas";
import {
  scorePHRFToD,
  getTimeAllowanceDiff,
  estimateORCFromPHRF,
  estimateTCCFromPHRF,
} from "@stax/handicap-core";
import { generateRSAKeyPair } from "@stax/activity-core";
import { syncResendStats } from "../lib/mailer";

// Import helper functions exported from index.ts
import {
  fetchAdminStats,
  fetchHeartbeatTelemetry,
  fetchGA4Report,
  fetchEntities,
  processInoreaderItemDate,
  dbInsertInoreaderItem,
  processFeedlyItemDate,
  dbInsertFeedlyItem,
  buildEntityRss,
  buildCombinedRss,
  processArticleReaction,
  isDiscussionEnabledForEntity,
  pingWebSubHub,
  triggerSavePageNow,
  analyticsClient,
} from "../index";

export const v1Router = Router();

// Resend initialization
const resend = new Resend(process.env.RESEND_API_KEY);

// BullMQ Queue connection
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

// Helper to structure manual errors into the Google-style nested envelope
export function sendError(res: Response, statusCode: number, code: string, message: string, details?: any) {
  res.status(statusCode).json({
    error: {
      code,
      message,
      details: details ?? null,
    },
  } satisfies ApiErrorResponse);
}

function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
  res.status(statusCode).json({ data, statusCode });
}

// Redis-backed rate limiting — survives restarts and works across multiple instances.
// Fixed-window counter: INCR + PEXPIRE per IP per window slot.
// Fails open on Redis errors to avoid outages.
const rlRedis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  lazyConnect: true,
  enableOfflineQueue: false,
});

function rateLimit(options: { windowMs: number; max: number }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.ip || req.socket.remoteAddress || "unknown").toString();
    const window = Math.floor(Date.now() / options.windowMs);
    const key = `rl:v1:${ip}:${window}`;
    try {
      const count = await rlRedis.incr(key);
      if (count === 1) await rlRedis.pexpire(key, options.windowMs + 1000);
      if (count > options.max) {
        return sendError(res, 429, "TOO_MANY_REQUESTS", "Too many requests. Please try again later.");
      }
    } catch {
      // Redis unavailable — fail open to avoid blocking legitimate traffic
    }
    next();
  };
}

// ─── Public Endpoints ────────────────────────────────────────────────────────

// GET /api/v1/status
v1Router.get("/status", async (req, res, next) => {
  try {
    const dbCheck = await query("SELECT COUNT(*) FROM languages");
    sendSuccess(res, {
      status: "online",
      database: "connected",
      languages_count: parseInt(dbCheck.rows[0].count, 10),
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/ticker
v1Router.get("/ticker", async (req, res, next) => {
  try {
    const dbRes = await query(`
      SELECT id, title, canonical_url, publisher_name, published_at, metadata
      FROM article_links
      ORDER BY created_at DESC
      LIMIT 20
    `);
    sendSuccess(res, { articles: dbRes.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/newsletters/latest
v1Router.get("/newsletters/latest", async (req, res, next) => {
  try {
    const dbRes = await query(
      `SELECT id, title, content_md, status, created_at
       FROM newsletters
       WHERE status = 'published'
       ORDER BY created_at DESC
       LIMIT 1`
    );
    if (dbRes.rowCount === 0) {
      return sendSuccess(res, { newsletter: null });
    }
    sendSuccess(res, { newsletter: dbRes.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/newsletters/archive (with cursor pagination support)
v1Router.get("/newsletters/archive", async (req, res, next) => {
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const cursor = req.query.cursor as string; // YYYY-MM-DDTHH:mm:ss.sssZ format

  try {
    let q = `
      SELECT id, title, status, created_at
      FROM newsletters
      WHERE status = 'published'
    `;
    const params: any[] = [];

    if (cursor) {
      q += ` AND created_at < $1`;
      params.push(new Date(cursor));
    }

    q += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit + 1); // Fetch 1 extra to check for next page

    const dbRes = await query(q, params);
    const hasNextPage = dbRes.rows.length > limit;
    const items = hasNextPage ? dbRes.rows.slice(0, limit) : dbRes.rows;
    const nextCursor = hasNextPage ? items[items.length - 1].created_at.toISOString() : null;

    sendSuccess(res, {
      newsletters: items,
      next_cursor: nextCursor,
      has_next_page: hasNextPage
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/newsletters/feed.rss
v1Router.get("/newsletters/feed.rss", async (req, res, next) => {
  try {
    const dbRes = await query(
      `SELECT id, title, content_md, created_at
       FROM newsletters
       WHERE status = 'published'
       ORDER BY created_at DESC
       LIMIT 20`
    );
    
    const apiBase = process.env.API_BASE_URL ?? "https://api.sailsouthern.com";
    const webBase = process.env.WEB_BASE_URL ?? "https://sailsouthern.com";
    const escXml = (s: string) => s?.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;") ?? "";

    res.setHeader("Content-Type", "application/rss+xml");
    
    let rss = `<?xml version="1.0" encoding="UTF-8" ?>\n`;
    rss += `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n`;
    rss += `<channel>\n`;
    rss += `    <title>Sailing Almanac Daily Digest Feed</title>\n`;
    rss += `    <link>${escXml(webBase)}/daily</link>\n`;
    rss += `    <description>Daily newsletter gazette summarizing the latest in sailing, regattas, and boating.</description>\n`;
    rss += `    <language>en-us</language>\n`;
    rss += `    <atom:link href="${escXml(apiBase)}/api/v1/newsletters/feed.rss" rel="self" type="application/rss+xml"/>\n`;
    
    for (const row of dbRes.rows) {
      const titleDate = new Date(row.created_at).toISOString().split("T")[0];
      const link = `${webBase}/daily/${titleDate}`;
      rss += `    <item>\n`;
      rss += `        <title>${escXml(row.title)}</title>\n`;
      rss += `        <link>${escXml(link)}</link>\n`;
      rss += `        <guid isPermaLink="true">${escXml(link)}</guid>\n`;
      rss += `        <pubDate>${new Date(row.created_at).toUTCString()}</pubDate>\n`;
      rss += `        <description><![CDATA[${row.content_md}]]></description>\n`;
      rss += `    </item>\n`;
    }
    
    rss += `</channel>\n`;
    rss += `</rss>\n`;
    
    res.status(200).send(rss);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/newsletters/:date
v1Router.get("/newsletters/:date", async (req, res, next) => {
  try {
    const dbRes = await query(
      `SELECT id, title, content_md, status, created_at
       FROM newsletters
       WHERE created_at::date = $1::date
       LIMIT 1`,
      [req.params.date]
    );
    if (dbRes.rowCount === 0) {
      return sendError(res, 404, "NOT_FOUND", "Newsletter not found");
    }
    sendSuccess(res, { newsletter: dbRes.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/search
v1Router.get("/search", async (req, res, next) => {
  const q = (req.query.q as string || "").trim();
  if (!q) return sendSuccess(res, { results: [] });
  try {
    const meiliUrl = process.env.MEILI_HTTP_ADDR || "http://localhost:7700";
    const meiliKey = process.env.MEILI_MASTER_KEY || "";
    const meiliRes = await fetch(
      `${meiliUrl}/indexes/article_links/search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${meiliKey}`,
        },
        body: JSON.stringify({
          q,
          limit: 10,
          filter: "is_suppressed = false AND (relevance_score > 0.1 OR relevance_score IS NULL)",
        }),
      }
    );
    if (meiliRes.ok) {
      const data = await meiliRes.json() as any;
      return sendSuccess(res, { source: "meilisearch", results: data.hits || [] });
    }
    throw new Error("Meilisearch unavailable");
  } catch (error) {
    logger.warn("[Search] Meilisearch unavailable, falling back to Postgres ILIKE:", { error: String(error) });
    try {
      const dbRes = await query(
        `SELECT id, canonical_url, title, publisher_name, published_at
         FROM article_links
         WHERE title ILIKE $1
         ORDER BY published_at DESC
         LIMIT 10`,
        [`%${q}%`]
      );
      sendSuccess(res, { source: "postgres_fallback", results: dbRes.rows });
    } catch (dbErr) {
      next(dbErr);
    }
  }
});

// GET /api/v1/feeds
v1Router.get("/feeds", async (req, res, next) => {
  const page = parseInt((req.query.page as string) || "1", 10);
  const limit = parseInt((req.query.limit as string) || "50", 10);
  const offset = (page - 1) * limit;
  try {
    const dbRes = await query(
      `SELECT * FROM feed_endpoints ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const count = await query("SELECT COUNT(*) FROM feed_endpoints");
    sendSuccess(res, { page, limit, total: parseInt(count.rows[0].count), feeds: dbRes.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/feeds/submit
v1Router.post("/feeds/submit", async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url || !url.startsWith("http")) {
      return sendError(res, 400, "VALIDATION_ERROR", "Invalid URL provided. Must start with http or https.");
    }

    const cleanUrl = url.trim();
    const checkRes = await query("SELECT id FROM feed_endpoints WHERE url = $1", [cleanUrl]);
    if (checkRes.rowCount && checkRes.rowCount > 0) {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "Feed already exists in database.",
          details: { feedId: checkRes.rows[0].id }
        }
      });
    }

    const insertRes = await query(
      "INSERT INTO feed_endpoints (url, is_active) VALUES ($1, false) RETURNING id",
      [cleanUrl]
    );

    sendSuccess(res, {
      message: "Feed submitted successfully for moderation.",
      feedId: insertRes.rows[0].id,
    }, 201);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/feeds/opml
v1Router.get("/feeds/opml", async (req, res, next) => {
  try {
    const dbRes = await query("SELECT url FROM feed_endpoints WHERE is_active = true ORDER BY url ASC");
    const feeds = dbRes.rows;

    let opml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    opml += `<opml version="2.0">\n`;
    opml += `  <head>\n`;
    opml += `    <title>Sailing Almanac curated feeds</title>\n`;
    opml += `    <dateCreated>${new Date().toUTCString()}</dateCreated>\n`;
    opml += `  </head>\n`;
    opml += `  <body>\n`;
    opml += `    <outline text="Sailing News Feeds" title="Sailing News Feeds">\n`;

    for (const feed of feeds) {
      const cleanUrl = feed.url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&apos;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      opml += `      <outline type="rss" xmlUrl="${cleanUrl}" htmlUrl="${cleanUrl}" />\n`;
    }

    opml += `    </outline>\n`;
    opml += `  </body>\n`;
    opml += `</opml>\n`;

    res.header("Content-Type", "application/xml");
    res.status(200).send(opml);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/feeds/combined
v1Router.get("/feeds/combined", async (req, res, next) => {
  try {
    const entitySlugs = ((req.query.entities as string) ?? "").split(",").map(s => s.trim()).filter(Boolean);
    if (!entitySlugs.length) return res.status(400).send("<error>entities param required</error>");

    const entityIds = await query(
      `SELECT id, canonical_name FROM entities WHERE slug = ANY($1::text[])`,
      [entitySlugs]
    );
    if (!entityIds.rows.length) return res.status(404).send("<error>No entities found</error>");

    const ids = entityIds.rows.map((r: any) => r.id);
    const articlesRes = await query(
      `SELECT DISTINCT al.title, al.redirect_hash, al.canonical_url, al.content_snippet,
              al.publisher_name, al.published_at
       FROM entity_mentions em
       JOIN article_links al ON al.id = em.article_id
       WHERE em.entity_id = ANY($1::int[]) AND al.is_suppressed = FALSE
       ORDER BY al.published_at DESC
       LIMIT 50`,
      [ids]
    );

    const title = entityIds.rows.map((r: any) => r.canonical_name).join(" + ");
    const rss = buildCombinedRss(title, entitySlugs, articlesRes.rows);
    res.header("Content-Type", "application/rss+xml; charset=utf-8").send(rss);
  } catch (err: any) {
    next(err);
  }
});

// GET /api/v1/editions/current
v1Router.get("/editions/current", async (_req, res, next) => {
  try {
    const edRes = await query(
      `SELECT id, edition_date, edition_label, edition_type, published_at
       FROM newsletter_editions
       WHERE status = 'published'
       ORDER BY edition_date DESC, published_at DESC
       LIMIT 1`
    );
    if (!edRes.rows[0]) return sendSuccess(res, { edition: null, markdown: null });
    const edition = edRes.rows[0];
    const markdown = await renderEdition(edition.id);
    sendSuccess(res, { edition, markdown });
  } catch (err: any) {
    next(err);
  }
});

// GET /api/v1/editions/:date
v1Router.get("/editions/:date", async (req, res, next) => {
  try {
    const type = req.query.type === "weekly" ? "weekly" : "daily";
    const edRes = await query(
      `SELECT id, edition_date, edition_label, edition_type, status, published_at
       FROM newsletter_editions
       WHERE edition_date = $1::date AND edition_type = $2
       LIMIT 1`,
      [req.params.date, type]
    );
    if (!edRes.rows[0]) {
      return sendError(res, 404, "NOT_FOUND", "Edition not found");
    }
    const edition = edRes.rows[0];
    const markdown = await renderEdition(edition.id);
    sendSuccess(res, { edition, markdown });
  } catch (err: any) {
    next(err);
  }
});

// GET /api/v1/editions/:date/:section
v1Router.get("/editions/:date/:section", async (req, res, next) => {
  try {
    const type = req.query.type === "weekly" ? "weekly" : "daily";
    const edRes = await query(
      `SELECT ne.id FROM newsletter_editions ne
       WHERE ne.edition_date = $1::date AND ne.edition_type = $2
       LIMIT 1`,
      [req.params.date, type]
    );
    if (!edRes.rows[0]) {
      return sendError(res, 404, "NOT_FOUND", "Edition not found");
    }
    const editionId = edRes.rows[0].id;
    const sectionSlug = req.params.section;

    const slotsRes = await query(
      `SELECT al.id, al.title, al.redirect_hash, al.canonical_url, al.og_image_url,
              al.content_snippet, al.publisher_name, al.published_at,
              ns.section, ns.section_display_name, ns.slot_position
       FROM newsletter_slots ns
       JOIN article_links al ON al.id = ns.article_id
       WHERE ns.edition_id = $1 AND ns.section = $2 AND ns.is_active = TRUE
       ORDER BY ns.slot_position ASC`,
      [editionId, sectionSlug]
    );
    sendSuccess(res, { section: sectionSlug, articles: slotsRes.rows });
  } catch (err: any) {
    next(err);
  }
});

// GET /api/v1/entities
v1Router.get("/entities", async (req, res, next) => {
  try {
    const result = await fetchEntities(req.query);
    sendSuccess(res, result);
  } catch (err: any) {
    next(err);
  }
});

// GET /api/v1/entities/:slug
v1Router.get("/entities/:slug", async (req, res, next) => {
  try {
    const entityRes = await query(
      `SELECT e.*, et.slug AS entity_type, et.label AS entity_type_label
       FROM entities e JOIN entity_types et ON et.id = e.entity_type_id
       WHERE e.slug = $1`,
      [req.params.slug]
    );
    if (!entityRes.rows[0]) {
      return sendError(res, 404, "NOT_FOUND", "Entity not found");
    }
    const entity = entityRes.rows[0];

    const articlesRes = await query(
      `SELECT al.id, al.title, al.redirect_hash, al.canonical_url, al.og_image_url,
              al.publisher_name, al.published_at, al.content_snippet,
              em.confidence, em.mention_text
       FROM entity_mentions em
       JOIN article_links al ON al.id = em.article_id
       WHERE em.entity_id = $1
         AND al.is_suppressed = FALSE
       ORDER BY al.published_at DESC
       LIMIT 10`,
      [entity.id]
    );

    const apiBase = process.env.API_BASE_URL ?? "https://api.sailsouthern.com";
    const articles = articlesRes.rows.map((a: any) => ({
      ...a,
      sendit_url: a.redirect_hash
        ? `${apiBase}/api/v1/sendit/${a.redirect_hash}?src=web`
        : a.canonical_url,
    }));

    sendSuccess(res, { entity, articles });
  } catch (err: any) {
    next(err);
  }
});

// GET /api/v1/entities/:slug/feed.rss
v1Router.get("/entities/:slug/feed.rss", async (req, res, next) => {
  try {
    const entityRes = await query(
      `SELECT e.id, e.canonical_name, e.slug, e.description FROM entities e WHERE e.slug = $1`,
      [req.params.slug]
    );
    if (!entityRes.rows[0]) return res.status(404).send("<rss><error>Not found</error></rss>");
    const entity = entityRes.rows[0];

    const articlesRes = await query(
      `SELECT al.title, al.redirect_hash, al.canonical_url, al.content_snippet,
              al.publisher_name, al.published_at
       FROM entity_mentions em
       JOIN article_links al ON al.id = em.article_id
       WHERE em.entity_id = $1 AND al.is_suppressed = FALSE
       ORDER BY al.published_at DESC
       LIMIT 50`,
      [entity.id]
    );

    const rss = buildEntityRss(entity, articlesRes.rows);
    res.header("Content-Type", "application/rss+xml; charset=utf-8").send(rss);
  } catch (err: any) {
    next(err);
  }
});

// POST /api/v1/entities
v1Router.post("/entities", async (req, res, next) => {
  try {
    const { entity_type, canonical_name, aliases, description, metadata } = req.body;
    if (!entity_type || !canonical_name) {
      return sendError(res, 400, "VALIDATION_ERROR", "entity_type and canonical_name required");
    }
    const slug = canonical_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const typeRes = await query("SELECT id FROM entity_types WHERE slug = $1", [entity_type]);
    if (!typeRes.rows[0]) {
      return sendError(res, 400, "VALIDATION_ERROR", "Unknown entity_type");
    }

    const inserted = await query(
      `INSERT INTO entities (entity_type_id, slug, canonical_name, aliases, description, metadata, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, FALSE)
       ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
       RETURNING id, slug`,
      [typeRes.rows[0].id, slug, canonical_name, aliases ?? [], description ?? null, JSON.stringify(metadata ?? {})]
    );
    sendSuccess(res, { entity_id: inserted.rows[0].id, slug: inserted.rows[0].slug }, 201);
  } catch (err: any) {
    next(err);
  }
});

// POST /api/v1/subscribe
v1Router.post("/subscribe", validate(subscribeSchema), async (req, res, next) => {
  try {
    const { email, frequency } = req.body;

    const existing = await query("SELECT is_active FROM email_subscriptions WHERE email = $1", [email]);
    if (existing.rows[0]?.is_active) {
      return sendError(res, 409, "DUPLICATE_EMAIL", "Email already subscribed");
    }

    const freq = Array.isArray(frequency) && frequency.length ? frequency : ["daily"];
    const token = crypto.randomBytes(32).toString("hex");

    await query(
      `INSERT INTO email_subscriptions (email, frequency, confirmation_token, is_active)
       VALUES ($1, $2, $3, FALSE)
       ON CONFLICT (email) DO UPDATE
         SET frequency = EXCLUDED.frequency,
             confirmation_token = EXCLUDED.confirmation_token,
             is_active = FALSE,
             unsubscribed_at = NULL`,
      [email, freq, token]
    );

    const confirmUrl = `${process.env.API_BASE_URL ?? "https://api.sailsouthern.com"}/api/v1/subscribe/confirm/${token}`;

    await resend.emails.send({
      from: "Sailing Almanac <hello@sailsouthern.com>",
      to: email,
      subject: "Confirm your Sail Southern subscription",
      html: `<p>Click to confirm your subscription: <a href="${confirmUrl}">${confirmUrl}</a></p>`,
    });

    sendSuccess(res, { status: "confirmation_sent" }, 201);
  } catch (err: any) {
    next(err);
  }
});

// GET /api/v1/subscribe/confirm/:token
v1Router.get("/subscribe/confirm/:token", async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE email_subscriptions
       SET is_active = TRUE, confirmed_at = NOW(), confirmation_token = NULL
       WHERE confirmation_token = $1
       RETURNING email`,
      [req.params.token]
    );
    if (!result.rows[0]) {
      return sendError(res, 400, "INVALID_TOKEN", "Invalid or expired confirmation link.");
    }
    const webBase = process.env.WEB_BASE_URL ?? "https://sailsouthern.com";
    res.redirect(302, `${webBase}/?subscribed=1`);
  } catch (err: any) {
    next(err);
  }
});

// POST /api/v1/unsubscribe
v1Router.post("/unsubscribe", async (req, res, next) => {
  try {
    const { email, token } = req.body as { email?: string; token?: string };
    if (!email && !token) {
      return sendError(res, 400, "VALIDATION_ERROR", "email or token required");
    }
    const condition = token ? "confirmation_token = $1" : "email = $1";
    await query(
      `UPDATE email_subscriptions SET is_active = FALSE, unsubscribed_at = NOW() WHERE ${condition}`,
      [token ?? email]
    );
    sendSuccess(res, { status: "unsubscribed" });
  } catch (err: any) {
    next(err);
  }
});

// GET /api/v1/supporters/public
v1Router.get("/supporters/public", async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT s.display_name, s.tier_id, s.social_handle, s.social_platform, s.joined_at, t.display_name AS tier_name
       FROM supporters s
       LEFT JOIN supporter_tiers t ON s.tier_id = t.id
       WHERE s.is_anonymous = FALSE AND s.is_active = TRUE
       ORDER BY s.joined_at ASC`
    );
    sendSuccess(res, { supporters: result.rows });
  } catch (err: any) {
    next(err);
  }
});

// POST /api/v1/boats/:id/vote
v1Router.post("/boats/:id/vote", validate(boatVoteSchema), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Invalid boat ID");
    }

    const { field_name, vote, comment } = req.body;

    const boatCheck = await query(`SELECT id FROM boats WHERE id = $1`, [id]);
    if (!boatCheck.rows[0]) {
      return sendError(res, 404, "NOT_FOUND", "Boat not found");
    }

    const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
    const ua = req.headers["user-agent"] || "unknown_ua";
    const voter_hash = crypto.createHash("sha256").update(ip + ua).digest("hex");

    await query(
      `INSERT INTO boat_spec_votes (boat_id, field_name, vote, comment, voter_hash)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, field_name, vote, comment || null, voter_hash]
    );

    sendSuccess(res, { success: true, message: "Vote registered successfully." });
  } catch (err: any) {
    next(err);
  }
});

// GET /api/v1/boats
v1Router.get("/boats", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const offset = (page - 1) * limit;

    const builder = req.query.builder as string;
    const model = req.query.model as string;
    const rigType = req.query.rig_type as string;
    const yearRange = req.query.year_range as string;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (builder) {
      conditions.push(`builder_name ILIKE $${paramIndex}`);
      params.push(`%${builder}%`);
      paramIndex++;
    }
    if (model) {
      conditions.push(`model_name ILIKE $${paramIndex}`);
      params.push(`%${model}%`);
      paramIndex++;
    }
    if (rigType) {
      conditions.push(`rig_type ILIKE $${paramIndex}`);
      params.push(`%${rigType}%`);
      paramIndex++;
    }
    if (yearRange) {
      const parts = yearRange.split("-");
      if (parts.length === 2) {
        const start = parseInt(parts[0], 10);
        const end = parseInt(parts[1], 10);
        if (!isNaN(start) && !isNaN(end)) {
          conditions.push(`year_start >= $${paramIndex} AND year_start <= $${paramIndex + 1}`);
          params.push(start, end);
          paramIndex += 2;
        }
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRes = await query(`SELECT COUNT(*)::int FROM boats ${whereClause}`, params);
    const total = countRes.rows[0].count;

    params.push(limit, offset);
    const selectQueryStr = `
      SELECT id, builder_name, model_name, variant_name, year_start, year_end, hull_type, rig_type, loa_m, displacement_kg
      FROM boats
      ${whereClause}
      ORDER BY builder_name ASC, model_name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const boatsRes = await query(selectQueryStr, params);

    sendSuccess(res, {
      boats: boatsRes.rows,
      page,
      limit,
      total
    });
  } catch (err: any) {
    next(err);
  }
});

// GET /api/v1/boats/:id
v1Router.get("/boats/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Invalid boat ID");
    }

    const boatRes = await query(`SELECT * FROM boats WHERE id = $1`, [id]);
    if (!boatRes.rows[0]) {
      return sendError(res, 404, "NOT_FOUND", "Boat not found");
    }

    const sourcesRes = await query(
      `SELECT source_type, source_url, last_seen_at FROM boat_sources WHERE boat_id = $1`,
      [id]
    );

    const consensusRes = await query(
      `SELECT field_name, value_numeric, value_text, confidence, num_sources, num_thumbs_up, num_flags, debug_info
       FROM boat_spec_consensus
       WHERE boat_id = $1`,
      [id]
    );

    const specs: Record<string, any> = {};
    for (const row of consensusRes.rows) {
      specs[row.field_name] = {
        value: row.value_numeric !== null ? row.value_numeric : row.value_text,
        confidence: row.confidence,
        num_sources: row.num_sources,
        num_thumbs_up: row.num_thumbs_up,
        num_flags: row.num_flags,
        debug_info: row.debug_info
      };
    }

    sendSuccess(res, {
      boat: boatRes.rows[0],
      specs,
      sources: sourcesRes.rows
    });
  } catch (err: any) {
    next(err);
  }
});

// GET /api/v1/handicap/phrf/regions
v1Router.get("/handicap/phrf/regions", async (req, res, next) => {
  try {
    const result = await query("SELECT slug, name, authority_url FROM phrf_regions ORDER BY name ASC");
    sendSuccess(res, { regions: result.rows });
  } catch (err: any) {
    next(err);
  }
});

// GET /api/v1/handicap/phrf/ratings
v1Router.get("/handicap/phrf/ratings", async (req, res, next) => {
  try {
    const boatId = parseInt(req.query.boat_id as string, 10);
    if (isNaN(boatId)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Invalid or missing boat_id parameter");
    }

    const regionsStr = req.query.regions as string;
    let regionsFilter: string[] = [];
    if (regionsStr) {
      regionsFilter = regionsStr.split(",").map(s => s.trim()).filter(Boolean);
    }

    let q = `
      SELECT r.rating_base, r.rating_spin, r.rating_nonspin, r.notes, r.source_url, reg.slug AS region_slug, reg.name AS region_name
      FROM phrf_ratings r
      JOIN phrf_regions reg ON r.region_id = reg.id
      WHERE r.boat_id = $1
    `;
    const params: any[] = [boatId];

    if (regionsFilter.length > 0) {
      q += " AND reg.slug = ANY($2)";
      params.push(regionsFilter);
    }

    const ratingsRes = await query(q, params);
    sendSuccess(res, { ratings: ratingsRes.rows });
  } catch (err: any) {
    next(err);
  }
});

// POST /api/v1/handicap/phrf/compare
v1Router.post("/handicap/phrf/compare", validate(phrfCompareSchema), async (req, res, next) => {
  try {
    const { boat_id, regions, distance_nm } = req.body;

    const boatCheck = await query("SELECT id, builder_name, model_name FROM boats WHERE id = $1", [boat_id]);
    if (!boatCheck.rows[0]) {
      return sendError(res, 404, "NOT_FOUND", "Boat not found");
    }

    const ratingsRes = await query(
      `SELECT r.rating_base, r.rating_spin, r.rating_nonspin, reg.slug AS region_slug, reg.name AS region_name
       FROM phrf_ratings r
       JOIN phrf_regions reg ON r.region_id = reg.id
       WHERE r.boat_id = $1 AND reg.slug = ANY($2)`,
      [boat_id, regions]
    );

    const ratings = ratingsRes.rows;
    const comparisons = ratings.map((r) => {
      return {
        region_slug: r.region_slug,
        region_name: r.region_name,
        rating_base: r.rating_base,
        rating_spin: r.rating_spin,
        rating_nonspin: r.rating_nonspin,
        allowance_base_seconds: r.rating_base !== null ? r.rating_base * distance_nm : null,
        allowance_spin_seconds: r.rating_spin !== null ? r.rating_spin * distance_nm : null,
        allowance_nonspin_seconds: r.rating_nonspin !== null ? r.rating_nonspin * distance_nm : null,
      };
    });

    const deltas: any[] = [];
    for (let i = 0; i < ratings.length; i++) {
      for (let j = i + 1; j < ratings.length; j++) {
        const regA = ratings[i];
        const regB = ratings[j];

        if (regA.rating_base !== null && regB.rating_base !== null) {
          deltas.push({
            from_region: regA.region_slug,
            to_region: regB.region_slug,
            type: "base",
            rating_diff: regA.rating_base - regB.rating_base,
            time_delta_seconds: getTimeAllowanceDiff(regA.rating_base, regB.rating_base, distance_nm),
          });
        }
        if (regA.rating_spin !== null && regB.rating_spin !== null) {
          deltas.push({
            from_region: regA.region_slug,
            to_region: regB.region_slug,
            type: "spin",
            rating_diff: regA.rating_spin - regB.rating_spin,
            time_delta_seconds: getTimeAllowanceDiff(regA.rating_spin, regB.rating_spin, distance_nm),
          });
        }
        if (regA.rating_nonspin !== null && regB.rating_nonspin !== null) {
          deltas.push({
            from_region: regA.region_slug,
            to_region: regB.region_slug,
            type: "nonspin",
            rating_diff: regA.rating_nonspin - regB.rating_nonspin,
            time_delta_seconds: getTimeAllowanceDiff(regA.rating_nonspin, regB.rating_nonspin, distance_nm),
          });
        }
      }
    }

    sendSuccess(res, {
      boat: boatCheck.rows[0],
      distance_nm,
      comparisons,
      deltas,
    });
  } catch (err: any) {
    next(err);
  }
});

// POST /api/v1/handicap/estimate
v1Router.post("/handicap/estimate", validate(handicapEstimateSchema), async (req, res, next) => {
  try {
    const { boat_id, phrf_rating, region_slug } = req.body;

    const boatRes = await query("SELECT id, builder_name, model_name FROM boats WHERE id = $1", [boat_id]);
    if (!boatRes.rows[0]) {
      return sendError(res, 404, "NOT_FOUND", "Boat not found");
    }

    const consensusRes = await query(
      "SELECT field_name, value_numeric FROM boat_spec_consensus WHERE boat_id = $1",
      [boat_id]
    );

    const specs: Record<string, number> = {};
    for (const row of consensusRes.rows) {
      if (row.value_numeric !== null) {
        specs[row.field_name] = Number(row.value_numeric);
      }
    }

    const orcEstimate = estimateORCFromPHRF(phrf_rating, specs);
    const ircEstimate = estimateTCCFromPHRF(phrf_rating, specs);

    sendSuccess(res, {
      boat: boatRes.rows[0],
      phrf_rating,
      region_slug: region_slug || null,
      orc: orcEstimate,
      irc: ircEstimate,
      is_educational: true,
      disclaimer: "These estimates are for educational and planning purposes only and are not official rating certificates."
    });
  } catch (err: any) {
    next(err);
  }
});

// POST /api/v1/handicap/fleet-intel
v1Router.post("/handicap/fleet-intel", validate(fleetIntelSchema), async (req, res, next) => {
  try {
    const { boat_identifiers, wind_band } = req.body;
    const matchedCerts: any[] = [];

    for (const ident of boat_identifiers) {
      let certRes = await query(
        `SELECT c.*, b.builder_name, b.model_name 
         FROM orc_certificates c
         JOIN boats b ON c.boat_id = b.id
         WHERE c.external_id = $1`,
        [ident]
      );
      if (certRes.rows[0]) {
        matchedCerts.push(certRes.rows[0]);
        continue;
      }

      certRes = await query(
        `SELECT c.*, b.builder_name, b.model_name 
         FROM orc_certificates c
         JOIN boats b ON c.boat_id = b.id
         WHERE b.model_name ILIKE $1 OR b.builder_name || ' ' || b.model_name ILIKE $1`,
        [`%${ident}%`]
      );
      if (certRes.rows[0]) {
        matchedCerts.push(certRes.rows[0]);
      }
    }

    const analyzedBoats = matchedCerts.map((cert) => {
      const loa = cert.loa_m || 8.0;
      const displacement = cert.displacement_kg || 2000;
      const sa = cert.upwind_sa_m2 || 30.0;
      
      const saDispRatio = sa / Math.pow(displacement / 1025, 2/3);
      const lwl = cert.lwl_m || (loa * 0.85);
      const dispTons = displacement / 1016.05;
      const dlRatio = lwl > 0 ? (dispTons / Math.pow(0.01 * lwl, 3)) : 200;

      let favoredWind = "medium";
      let heuristicText = "Balanced all-rounder, performing best in moderate breezes.";
      
      if (saDispRatio > 22 && dlRatio < 160) {
        favoredWind = "light";
        heuristicText = "Light, highly powered hull. Excels in light air and downwind planing.";
      } else if (dlRatio > 240) {
        favoredWind = "heavy";
        heuristicText = "Heavy displacement, high stability. Favored in heavy air and chop.";
      }

      return {
        external_id: cert.external_id,
        builder_name: cert.builder_name,
        model_name: cert.model_name,
        gph: cert.gph,
        loa_m: loa,
        displacement_kg: displacement,
        upwind_sa_m2: sa,
        sa_disp_ratio: Math.round(saDispRatio * 100) / 100,
        dl_ratio: Math.round(dlRatio * 100) / 100,
        favored_wind: favoredWind,
        heuristic_text: heuristicText,
      };
    });

    if (wind_band === "light") {
      analyzedBoats.sort((a, b) => b.sa_disp_ratio - a.sa_disp_ratio);
    } else if (wind_band === "heavy") {
      analyzedBoats.sort((a, b) => b.dl_ratio - a.dl_ratio);
    } else {
      analyzedBoats.sort((a, b) => a.gph - b.gph);
    }

    sendSuccess(res, {
      wind_band,
      boats: analyzedBoats,
      disclaimer: "Heuristics and ratios are derived from ORC certificate specs and are for strategic planning purposes only."
    });
  } catch (err: any) {
    next(err);
  }
});

// GET /api/v1/handicap/reports
v1Router.get("/handicap/reports", async (req, res, next) => {
  try {
    const dbRes = await query(
      `SELECT r.*, s.name as system_name, s.authority_name, s.authority_website
       FROM handicap_systems_reports r
       JOIN handicap_systems s ON s.system_slug = r.system_slug
       ORDER BY r.report_date DESC, r.system_slug ASC`
    );
    sendSuccess(res, { reports: dbRes.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/entities/:slug/actor
v1Router.get("/entities/:slug/actor", async (req, res, next) => {
  try {
    const slug = req.params.slug;
    let name = "";
    let bio = "";
    let type = "Person";
    let isValid = false;

    if (slug === "almanac") {
      name = "Sailing Almanac";
      bio = "The parent portal for regatta results, sailboat specifications, and handicap explorer.";
      isValid = true;
    } else if (slug === "sailsouthern") {
      name = "Sail Southern";
      bio = "Sail Southern regional sailing news, dispatches, and event analysis.";
      isValid = true;
    } else {
      const entityRes = await query("SELECT canonical_name, description FROM entities WHERE slug = $1", [slug]);
      if (entityRes.rows[0]) {
        name = entityRes.rows[0].canonical_name;
        bio = entityRes.rows[0].description || "";
        type = "Person";
        isValid = true;
      } else {
        const tribeRes = await query("SELECT name FROM tribes WHERE slug = $1", [slug]);
        if (tribeRes.rows[0]) {
          name = tribeRes.rows[0].name;
          bio = `Curated owner group and discussion forum for ${tribeRes.rows[0].name}`;
          type = "Group";
          isValid = true;
        }
      }
    }

    if (!isValid) {
      return sendError(res, 404, "NOT_FOUND", "Actor not found");
    }

    const host = req.headers.host || `${req.hostname}:4000`;
    const actorId = `https://${host}/api/v1/entities/${slug}/actor`;

    let keysRes = await query("SELECT public_key, lightning_address FROM actor_keys WHERE actor_id = $1", [actorId]);
    let publicKeyPem = "";
    let lightningAddress = "";

    if (keysRes.rows.length === 0) {
      const keys = generateRSAKeyPair();
      publicKeyPem = keys.publicKey;
      if (slug === "almanac") {
        lightningAddress = "almanac@sailingalmanac.com";
      } else if (slug === "sailsouthern") {
        lightningAddress = "sailsouthern@sailsouthern.com";
      }
      await query(
        "INSERT INTO actor_keys (actor_id, public_key, private_key, lightning_address) VALUES ($1, $2, $3, $4) ON CONFLICT (actor_id) DO NOTHING",
        [actorId, publicKeyPem, keys.privateKey, lightningAddress || null]
      );
    } else {
      publicKeyPem = keysRes.rows[0].public_key;
      lightningAddress = keysRes.rows[0].lightning_address || "";
    }

    const actor: any = {
      "@context": [
        "https://www.w3.org/ns/activitystreams",
        "https://w3id.org/security/v1"
      ],
      id: actorId,
      type,
      preferredUsername: slug,
      name,
      summary: bio,
      inbox: `https://${host}/api/v1/entities/${slug}/inbox`,
      outbox: `https://${host}/api/v1/entities/${slug}/outbox`,
      publicKey: {
        id: `${actorId}#main-key`,
        owner: actorId,
        publicKeyPem
      }
    };

    if (lightningAddress) {
      actor.attachment = [
        {
          type: "PropertyValue",
          name: "Lightning Address",
          value: lightningAddress
        }
      ];
    }

    res.setHeader("Content-Type", "application/activity+json");
    res.status(200).json(actor);
  } catch (err: any) {
    next(err);
  }
});

// POST /api/v1/entities/:slug/inbox
v1Router.post("/entities/:slug/inbox", async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const activity = req.body;

    if (!activity || !activity.type || !activity.actor) {
      return sendError(res, 400, "VALIDATION_ERROR", "Invalid activity payload");
    }

    const { type, actor } = activity;

    let isValid = slug === "almanac" || slug === "sailsouthern";
    if (!isValid) {
      const entityRes = await query("SELECT id FROM entities WHERE slug = $1", [slug]);
      const tribeRes = await query("SELECT id FROM tribes WHERE slug = $1", [slug]);
      isValid = entityRes.rows.length > 0 || tribeRes.rows.length > 0;
    }

    if (!isValid) {
      return sendError(res, 404, "NOT_FOUND", "Entity or tribe not found");
    }

    if (type === "Follow") {
      await query(
        `INSERT INTO entity_followers (entity_slug, follower_actor_uri)
         VALUES ($1, $2)
         ON CONFLICT (entity_slug, follower_actor_uri) DO NOTHING`,
        [slug, actor]
      );
      logger.info(`[ActivityPub Inbox] Actor ${actor} followed ${slug}`);

      fetch(actor, { headers: { "Accept": "application/activity+json" } })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Status ${response.status}`);
          const actorData = await response.json() as any;
          const followerInbox = actorData.inbox;
          if (followerInbox) {
            const host = req.headers.host || `${req.hostname}:4000`;
            const actorId = `https://${host}/api/v1/entities/${slug}/actor`;
            const acceptActivity = {
              "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://w3id.org/security/v1"
              ],
              id: `https://${host}/api/activities/${crypto.randomUUID()}`,
              type: "Accept",
              actor: actorId,
              object: activity
            };
            await queueOutboundActivity(actorId, followerInbox, acceptActivity);
          }
        })
        .catch((err) => logger.error(`[Inbox Follow Accept] Failed for ${actor}`, err));

    } else if (type === "Undo") {
      const nestedObject = activity.object;
      const targetActor = nestedObject?.actor || actor;
      
      await query(
        `DELETE FROM entity_followers WHERE entity_slug = $1 AND follower_actor_uri = $2`,
        [slug, targetActor]
      );
      logger.info(`[ActivityPub Inbox] Actor ${targetActor} unfollowed ${slug}`);
    }

    res.status(202).json({ status: "Accepted" });
  } catch (err: any) {
    next(err);
  }
});

// POST /api/v1/submissions
v1Router.post("/submissions", rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }), validate(userSubmissionSchema), async (req, res, next) => {
  try {
    const { submission_type, boat_id, submitter_email, content_payload, rights_grant } = req.body;

    const dbRes = await query(
      `INSERT INTO user_submissions (submission_type, boat_id, submitter_email, content_payload, rights_grant)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [submission_type, boat_id, submitter_email, JSON.stringify(content_payload), rights_grant]
    );

    const host = req.headers.host || `${req.hostname}:4000`;
    await triggerSavePageNow(`https://${host}/submissions/${dbRes.rows[0].id}`);

    sendSuccess(res, {
      message: "Submission received and queued for moderation.",
      id: dbRes.rows[0].id,
      created_at: dbRes.rows[0].created_at
    }, 201);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tribes/:slug/bulletins
v1Router.get("/tribes/:slug/bulletins", async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const isEnabled = await isDiscussionEnabledForEntity(slug);
    if (!isEnabled) {
      return sendError(res, 403, "FORBIDDEN", "Discussion is disabled for this profile.");
    }

    const tribeRes = await query("SELECT id FROM tribes WHERE slug = $1", [slug]);
    if (tribeRes.rows.length === 0) {
      return sendError(res, 404, "NOT_FOUND", "Tribe not found");
    }

    const bulletins = await query(
      "SELECT * FROM tribe_bulletins WHERE tribe_id = $1 ORDER BY is_pinned DESC, created_at DESC",
      [tribeRes.rows[0].id]
    );

    sendSuccess(res, { bulletins: bulletins.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/bulletins/:id/replies
v1Router.get("/bulletins/:id/replies", async (req, res, next) => {
  try {
    const bulletinId = parseInt(req.params.id, 10);
    const dbRes = await query(
      "SELECT * FROM bulletin_replies WHERE bulletin_id = $1 AND is_approved = TRUE ORDER BY created_at ASC",
      [bulletinId]
    );
    sendSuccess(res, { replies: dbRes.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/bulletins/:id/replies
v1Router.post("/bulletins/:id/replies", rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }), validate(createReplySchema), async (req, res, next) => {
  try {
    const bulletinId = parseInt(req.params.id, 10);
    const { author_actor_uri, author_name, content } = req.body;

    const bulletinRes = await query("SELECT id FROM tribe_bulletins WHERE id = $1", [bulletinId]);
    if (bulletinRes.rows.length === 0) {
      return sendError(res, 404, "NOT_FOUND", "Bulletin not found");
    }

    const dbRes = await query(
      `INSERT INTO bulletin_replies (bulletin_id, author_actor_uri, author_name, content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at, is_approved`,
      [bulletinId, author_actor_uri, author_name, content]
    );

    sendSuccess(res, {
      message: "Reply submitted and pending moderation.",
      reply: dbRes.rows[0]
    }, 201);
  } catch (err) {
    next(err);
  }
});


// ─── Admin Endpoints (Require X-Admin-Key Auth) ──────────────────────────────

// GET /api/v1/admin/stats
v1Router.get("/admin/stats", requireAdminKey, async (_req, res, next) => {
  try {
    const stats = await fetchAdminStats();
    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/admin/relevance/pending
v1Router.get("/admin/relevance/pending", requireAdminKey, async (req, res, next) => {
  const limit = parseInt((req.query.limit as string) || "20", 10);
  try {
    const dbRes = await query(`
      SELECT id, title, canonical_url, content_snippet, relevance_score, metadata, relevance_checked_at
      FROM article_links
      WHERE relevance_score IS NOT NULL
        AND is_suppressed = false
        AND (metadata->>'critique_processed' IS NULL)
      ORDER BY relevance_checked_at DESC
      LIMIT $1
    `, [limit]);

    sendSuccess(res, { articles: dbRes.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/admin/relevance/critique
v1Router.post("/admin/relevance/critique", requireAdminKey, async (req, res, next) => {
  const { id, corrected_score, critique, suppress } = req.body;
  if (!id) {
    return sendError(res, 400, "VALIDATION_ERROR", "Missing article ID");
  }

  try {
    const metaRes = await query("SELECT metadata FROM article_links WHERE id = $1", [id]);
    if (metaRes.rowCount === 0) {
      return sendError(res, 404, "NOT_FOUND", "Article not found");
    }

    const currentMeta = metaRes.rows[0].metadata || {};
    const updatedMeta = {
      ...currentMeta,
      critique: critique || null,
      critique_processed: true
    };

    let queryStr = `
      UPDATE article_links
      SET metadata = $1::jsonb
    `;
    const params: any[] = [JSON.stringify(updatedMeta)];

    let paramIdx = 2;
    if (corrected_score !== undefined) {
      queryStr += `, relevance_score = $${paramIdx}`;
      params.push(corrected_score);
      paramIdx++;
    }

    if (suppress !== undefined) {
      queryStr += `, is_suppressed = $${paramIdx}`;
      params.push(suppress);
      paramIdx++;
    }

    queryStr += ` WHERE id = $${paramIdx} RETURNING id`;
    params.push(id);

    await query(queryStr, params);
    sendSuccess(res, { message: "Critique applied successfully." });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/admin/heartbeat
v1Router.get("/admin/heartbeat", requireAdminKey, async (req, res, next) => {
  try {
    const telemetry = await fetchHeartbeatTelemetry();
    sendSuccess(res, telemetry);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/admin/analytics
v1Router.get("/admin/analytics", requireAdminKey, async (_req, res, next) => {
  const propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID;
  if (!analyticsClient || !propertyId) {
    return sendSuccess(res, { status: "unconfigured", message: "See docs/runbooks/ga4-setup.md" });
  }

  try {
    const reportData = await fetchGA4Report(propertyId);
    sendSuccess(res, {
      status: "configured",
      ...reportData
    });
  } catch (err: any) {
    next(err);
  }
});

// GET /api/v1/admin/analytics/report
v1Router.get("/admin/analytics/report", requireAdminKey, async (_req, res, next) => {
  const propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID;
  let ga4Report: any = null;
  if (analyticsClient && propertyId) {
    try {
      ga4Report = await fetchGA4Report(propertyId);
    } catch (err: any) {
      logger.error("[Admin Analytics Report] Failed to fetch GA4 report:", err);
    }
  }

  try {
    // 1. Sync Resend stats
    await syncResendStats();

    // 2. Query Resend stats from DB
    const resendStats = await query(
      `SELECT issue_date::text, sent, delivered, opened, clicked, bounced, complained 
       FROM resend_email_stats 
       ORDER BY issue_date DESC 
       LIMIT 30`
    );

    // 3. Query subscriber domains
    const subDomains = await query(
      `SELECT substring(email from '@(.*)$') AS domain, COUNT(*)::int as count 
       FROM subscribers 
       GROUP BY domain 
       ORDER BY count DESC 
       LIMIT 10`
    ).catch(() => ({ rows: [] }));

    const emailSubDomains = await query(
      `SELECT substring(email from '@(.*)$') AS domain, COUNT(*)::int as count 
       FROM email_subscriptions 
       GROUP BY domain 
       ORDER BY count DESC 
       LIMIT 10`
    ).catch(() => ({ rows: [] }));

    // 4. Query total subscriber counts
    const subTotal = await query("SELECT COUNT(*)::int as count FROM subscribers").catch(() => ({ rows: [{ count: 0 }] }));
    const emailSubTotal = await query("SELECT COUNT(*)::int as count FROM email_subscriptions").catch(() => ({ rows: [{ count: 0 }] }));

    // 5. Query redirect clicks details (top articles clicked)
    const clicksRes = await query(
      `SELECT al.title, al.canonical_url, COUNT(rc.id)::int as click_count
       FROM redirect_clicks rc
       JOIN article_links al ON al.id = rc.article_link_id
       GROUP BY al.title, al.canonical_url
       ORDER BY click_count DESC
       LIMIT 10`
    ).catch(() => ({ rows: [] }));

    // 6. Query click referrals / medium distribution
    const referrals = await query(
      `SELECT COALESCE(utm_medium, 'direct/web') as medium, COUNT(*)::int as count
       FROM redirect_clicks
       GROUP BY medium
       ORDER BY count DESC`
    ).catch(() => ({ rows: [] }));

    // 7. Query support conversions summary
    const conversionsRes = await query(
      `SELECT tier_name, COUNT(*)::int as count, SUM(amount)::float8 as total_amount 
       FROM support_conversions 
       GROUP BY tier_name 
       ORDER BY count DESC`
    ).catch(() => ({ rows: [] }));

    // 8. Query conversions by experiment variant
    const variantsRes = await query(
      `SELECT COALESCE(experiment_variant, 'A') as variant, COUNT(*)::int as count, SUM(amount)::float8 as total_amount 
       FROM support_conversions 
       GROUP BY variant`
    ).catch(() => ({ rows: [] }));

    // 9. Query custom amount details
    const customStatsRes = await query(
      `SELECT COUNT(*)::int as count, COALESCE(AVG(amount), 0)::float8 as average_amount 
       FROM support_conversions 
       WHERE tier_name = 'Custom Amount'`
    ).catch(() => ({ rows: [{ count: 0, average_amount: 0 }] }));

    sendSuccess(res, {
      ga4: ga4Report,
      resend_email_stats: resendStats.rows,
      subscribers: {
        total: subTotal.rows[0].count,
        domains: subDomains.rows,
      },
      email_subscriptions: {
        total: emailSubTotal.rows[0].count,
        domains: emailSubDomains.rows,
      },
      top_clicked_articles: clicksRes.rows,
      referrals: referrals.rows,
      support_conversions: conversionsRes.rows,
      experiment_variants: variantsRes.rows,
      custom_support_stats: customStatsRes.rows[0] || { count: 0, average_amount: 0 },
    });
  } catch (err: any) {
    next(err);
  }
});

// POST /api/v1/conversions — public, rate-limited, no auth
// Records support intent from the public support page without requiring admin credentials.
v1Router.post("/conversions", rateLimit({ windowMs: 60_000, max: 10 }), async (req, res, next) => {
  const { tier_name, amount, billing_type, experiment_variant } = req.body;
  if (!tier_name || amount === undefined || !billing_type) {
    return sendError(res, 400, "VALIDATION_ERROR", "tier_name, amount, and billing_type are required");
  }
  const sessionHash = crypto.createHash("sha256").update((req.ip || "").toString()).digest("hex");
  try {
    await query(
      `INSERT INTO support_conversions (session_hash, tier_name, amount, billing_type, experiment_variant)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionHash, tier_name, amount, billing_type, experiment_variant || null]
    );
    sendSuccess(res, { status: "recorded" }, 201);
  } catch (err: any) {
    next(err);
  }
});

// POST /api/v1/admin/analytics/conversion
v1Router.post("/admin/analytics/conversion", requireAdminKey, async (req, res, next) => {
  const { tier_name, amount, billing_type, experiment_variant } = req.body;
  if (!tier_name || amount === undefined || !billing_type) {
    return sendError(res, 400, "VALIDATION_ERROR", "tier_name, amount, and billing_type are required");
  }
  const sessionHash = crypto.createHash("sha256").update(req.ip || "").digest("hex");

  try {
    await query(
      `INSERT INTO support_conversions (session_hash, tier_name, amount, billing_type, experiment_variant)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionHash, tier_name, amount, billing_type, experiment_variant || null]
    );

    sendSuccess(res, { status: "recorded" }, 201);
  } catch (err: any) {
    next(err);
  }
});

// GET /api/v1/admin/boats/:id
v1Router.get("/admin/boats/:id", requireAdminKey, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Invalid boat ID");
    }

    const boatRes = await query(`SELECT * FROM boats WHERE id = $1`, [id]);
    if (!boatRes.rows[0]) {
      return sendError(res, 404, "NOT_FOUND", "Boat not found");
    }

    const sourcesRes = await query(`SELECT * FROM boat_sources WHERE boat_id = $1`, [id]);
    const consensusRes = await query(`SELECT * FROM boat_spec_consensus WHERE boat_id = $1`, [id]);

    sendSuccess(res, {
      boat: boatRes.rows[0],
      sources: sourcesRes.rows,
      consensus: consensusRes.rows
    });
  } catch (err: any) {
    next(err);
  }
});

// GET /api/v1/admin/submissions
v1Router.get("/admin/submissions", requireAdminKey, async (req, res, next) => {
  try {
    const dbRes = await query("SELECT * FROM user_submissions ORDER BY created_at DESC");
    sendSuccess(res, { submissions: dbRes.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/admin/submissions/:id/approve
v1Router.post("/admin/submissions/:id/approve", requireAdminKey, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const dbRes = await query(
      "UPDATE user_submissions SET is_approved = TRUE WHERE id = $1 RETURNING id, is_approved",
      [id]
    );
    if (dbRes.rows.length === 0) {
      return sendError(res, 404, "NOT_FOUND", "Submission not found");
    }
    sendSuccess(res, { message: "Submission approved successfully.", id: dbRes.rows[0].id });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/admin/tribes
v1Router.post("/admin/tribes", requireAdminKey, validate(createTribeSchema), async (req, res, next) => {
  try {
    const { slug, name, entity_ids, admin_email } = req.body;
    const dbRes = await query(
      `INSERT INTO tribes (slug, name, entity_ids, admin_email)
       VALUES ($1, $2, $3, $4)
       RETURNING id, slug, name`,
      [slug, name, entity_ids, admin_email]
    );
    sendSuccess(res, { message: "Tribe created successfully.", tribe: dbRes.rows[0] }, 201);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/admin/tribes/:slug/bulletins
v1Router.post("/admin/tribes/:slug/bulletins", requireAdminKey, validate(createBulletinSchema), async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const { title, body_md, is_pinned, author_email } = req.body;

    const tribeRes = await query("SELECT id FROM tribes WHERE slug = $1", [slug]);
    if (tribeRes.rows.length === 0) {
      return sendError(res, 404, "NOT_FOUND", "Tribe not found");
    }
    const tribeId = tribeRes.rows[0].id;

    const dbRes = await query(
      `INSERT INTO tribe_bulletins (tribe_id, title, body_md, is_pinned, author_email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [tribeId, title, body_md, is_pinned, author_email]
    );

    const followers = await query("SELECT follower_actor_uri FROM entity_followers WHERE entity_slug = $1", [slug]);
    const host = req.headers.host || `${req.hostname}:4000`;
    const actorId = `https://${host}/api/v1/entities/${slug}/actor`;

    for (const row of followers.rows) {
      const followerInbox = row.follower_actor_uri;
      const noteActivity = {
        "@context": [
          "https://www.w3.org/ns/activitystreams",
          "https://w3id.org/security/v1"
        ],
        id: `https://${host}/api/activities/${crypto.randomUUID()}`,
        type: "Create",
        actor: actorId,
        to: ["https://www.w3.org/ns/activitystreams#Public"],
        object: {
          id: `https://${host}/api/bulletins/${dbRes.rows[0].id}`,
          type: "Note",
          published: new Date(dbRes.rows[0].created_at).toISOString(),
          attributedTo: actorId,
          content: `<strong>${title}</strong><br/>${body_md}`,
          to: ["https://www.w3.org/ns/activitystreams#Public"]
        }
      };
      await queueOutboundActivity(actorId, followerInbox, noteActivity);
    }

    sendSuccess(res, {
      message: "Bulletin created and federated to followers.",
      id: dbRes.rows[0].id
    }, 201);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/replies/pending
v1Router.get("/admin/replies/pending", requireAdminKey, async (req, res, next) => {
  try {
    const dbRes = await query(
      `SELECT r.*, b.title AS bulletin_title 
       FROM bulletin_replies r
       JOIN tribe_bulletins b ON b.id = r.bulletin_id
       WHERE r.is_approved = FALSE 
       ORDER BY r.created_at ASC`
    );
    sendSuccess(res, { pending_replies: dbRes.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/admin/replies/:id/approve
v1Router.post("/admin/replies/:id/approve", requireAdminKey, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const dbRes = await query(
      "UPDATE bulletin_replies SET is_approved = TRUE WHERE id = $1 RETURNING id, is_approved",
      [id]
    );
    if (dbRes.rows.length === 0) {
      return sendError(res, 404, "NOT_FOUND", "Reply not found");
    }
    sendSuccess(res, { message: "Reply approved successfully.", id: dbRes.rows[0].id });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/admin/pings/websub
v1Router.post("/admin/pings/websub", requireAdminKey, async (req, res, next) => {
  try {
    const { feed_url } = req.body;
    if (!feed_url) {
      return sendError(res, 400, "VALIDATION_ERROR", "Missing feed_url");
    }
    await pingWebSubHub(feed_url);
    sendSuccess(res, { message: "WebSub ping initiated." });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/admin/pings/wayback
v1Router.post("/admin/pings/wayback", requireAdminKey, async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) {
      return sendError(res, 400, "VALIDATION_ERROR", "Missing url");
    }
    await triggerSavePageNow(url);
    sendSuccess(res, { message: "Wayback SPN save initiated." });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/supporters
v1Router.get("/supporters", requireAdminKey, async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT s.*, t.display_name AS tier_name
       FROM supporters s
       LEFT JOIN supporter_tiers t ON s.tier_id = t.id
       ORDER BY s.joined_at DESC`
    );
    sendSuccess(res, { supporters: result.rows });
  } catch (err: any) {
    next(err);
  }
});

// POST /api/v1/supporters
v1Router.post("/supporters", requireAdminKey, async (req, res, next) => {
  try {
    const {
      email,
      display_name,
      social_handle,
      social_platform,
      is_anonymous,
      tier_id,
      stripe_customer_id,
      stripe_payment_id,
      is_active,
      physical_gift_sent,
      physical_gift_address,
      notes,
    } = req.body;

    if (!email) {
      return sendError(res, 400, "VALIDATION_ERROR", "Email is required");
    }

    const result = await query(
      `INSERT INTO supporters
         (email, display_name, social_handle, social_platform, is_anonymous, tier_id,
          stripe_customer_id, stripe_payment_id, is_active, physical_gift_sent,
          physical_gift_address, notes, joined_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, NOW())
       RETURNING id`,
      [
        email,
        display_name ? sanitize(display_name) : null,
        social_handle ? sanitize(social_handle) : null,
        social_platform || null,
        is_anonymous === undefined ? false : !!is_anonymous,
        tier_id || null,
        stripe_customer_id || null,
        stripe_payment_id || null,
        is_active === undefined ? true : !!is_active,
        !!physical_gift_sent,
        physical_gift_address ? JSON.stringify(physical_gift_address) : null,
        notes || null,
      ]
    );

    sendSuccess(res, { id: result.rows[0].id }, 201);
  } catch (err: any) {
    next(err);
  }
});

// PATCH /api/v1/supporters/:id
v1Router.patch("/supporters/:id", requireAdminKey, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { physical_gift_sent, notes, is_anonymous, is_active } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    let p = 1;

    if (physical_gift_sent !== undefined) {
      updates.push(`physical_gift_sent = $${p}`);
      params.push(!!physical_gift_sent);
      p++;
    }
    if (notes !== undefined) {
      updates.push(`notes = $${p}`);
      params.push(notes);
      p++;
    }
    if (is_anonymous !== undefined) {
      updates.push(`is_anonymous = $${p}`);
      params.push(!!is_anonymous);
      p++;
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${p}`);
      params.push(!!is_active);
      p++;
    }

    if (updates.length === 0) {
      return sendError(res, 400, "VALIDATION_ERROR", "No fields to update");
    }

    params.push(id);
    const queryStr = `UPDATE supporters SET ${updates.join(", ")} WHERE id = $${p} RETURNING id`;
    
    const result = await query(queryStr, params);
    if (!result.rows[0]) {
      return sendError(res, 404, "NOT_FOUND", "Supporter not found");
    }

    sendSuccess(res, { id: result.rows[0].id });
  } catch (err: any) {
    next(err);
  }
});

// ─── Outbound Social Archive Endpoints ────────────────────────────────────────

// GET /api/v1/social/posts
v1Router.get("/social/posts", requireAdminKey, async (req, res, next) => {
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const cursor = req.query.cursor as string; // ISO datetime
  const platform = req.query.platform as string;
  const accountId = req.query.accountId ? parseInt(req.query.accountId as string, 10) : undefined;
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  const entityType = req.query.entityType as string;
  const entityId = req.query.entityId as string;

  try {
    let q = `
      SELECT DISTINCT p.id, p.content_text, p.title, p.linked_entity_type, p.linked_entity_id, p.metadata, p.provenance_rights, p.created_at
      FROM social_posts p
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (platform || accountId) {
      q += ` JOIN social_post_deliveries d ON d.post_id = p.id`;
      if (platform) {
        conditions.push(`d.platform = $${params.length + 1}`);
        params.push(platform);
      }
      if (accountId) {
        conditions.push(`d.account_id = $${params.length + 1}`);
        params.push(accountId);
      }
    }

    if (cursor) {
      conditions.push(`p.created_at < $${params.length + 1}`);
      params.push(new Date(cursor));
    }
    if (startDate) {
      conditions.push(`p.created_at >= $${params.length + 1}`);
      params.push(new Date(startDate));
    }
    if (endDate) {
      conditions.push(`p.created_at <= $${params.length + 1}`);
      params.push(new Date(endDate));
    }
    if (entityType) {
      conditions.push(`p.linked_entity_type = $${params.length + 1}`);
      params.push(entityType);
    }
    if (entityId) {
      conditions.push(`p.linked_entity_id = $${params.length + 1}`);
      params.push(entityId);
    }

    if (conditions.length > 0) {
      q += ` WHERE ` + conditions.join(" AND ");
    }

    q += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit + 1);

    const dbRes = await query(q, params);
    const hasNextPage = dbRes.rows.length > limit;
    const items = hasNextPage ? dbRes.rows.slice(0, limit) : dbRes.rows;
    const nextCursor = hasNextPage ? items[items.length - 1].created_at.toISOString() : null;

    if (items.length > 0) {
      const postIds = items.map((p) => p.id);
      
      const [delRes, metricsRes, capturesRes] = await Promise.all([
        query(
          `SELECT id, post_id, account_id, platform, external_id, external_url, status, error_message, delivered_at
           FROM social_post_deliveries
           WHERE post_id = ANY($1)`,
          [postIds]
        ),
        query(
          `SELECT DISTINCT ON (delivery_id) delivery_id, likes_count, shares_count, replies_count, impressions_count, snapshot_time
           FROM social_post_metrics_snapshots
           WHERE post_id = ANY($1)
           ORDER BY delivery_id, snapshot_time DESC`,
          [postIds]
        ),
        query(
          `SELECT id, post_id, delivery_id, capture_type, archive_url, captured_at, status
           FROM social_post_captures
           WHERE post_id = ANY($1)`,
          [postIds]
        )
      ]);

      const deliveriesMap = new Map<number, any[]>();
      for (const row of delRes.rows) {
        if (!deliveriesMap.has(row.post_id)) {
          deliveriesMap.set(row.post_id, []);
        }
        deliveriesMap.get(row.post_id)!.push(row);
      }

      const metricsMap = new Map<number, any>();
      for (const row of metricsRes.rows) {
        metricsMap.set(row.delivery_id, row);
      }

      const capturesMap = new Map<number, any[]>();
      for (const row of capturesRes.rows) {
        if (!capturesMap.has(row.post_id)) {
          capturesMap.set(row.post_id, []);
        }
        capturesMap.get(row.post_id)!.push(row);
      }

      for (const item of items) {
        const deliveries = deliveriesMap.get(item.id) || [];
        for (const del of deliveries) {
          del.latest_metrics = metricsMap.get(del.id) || null;
        }
        item.deliveries = deliveries;
        item.captures = capturesMap.get(item.id) || [];
      }
    }

    sendSuccess(res, {
      posts: items,
      next_cursor: nextCursor,
      has_next_page: hasNextPage
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/social/posts/:id
v1Router.get("/social/posts/:id", requireAdminKey, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return sendError(res, 400, "INVALID_PARAMETER", "ID must be a number");
  }

  try {
    const postRes = await query(`SELECT * FROM social_posts WHERE id = $1`, [id]);
    if (postRes.rowCount === 0) {
      return sendError(res, 404, "NOT_FOUND", `Social post with ID ${id} not found`);
    }
    const post = postRes.rows[0];

    const [delRes, mediaRes, linksRes, capturesRes, metricsRes] = await Promise.all([
      query(`SELECT * FROM social_post_deliveries WHERE post_id = $1`, [id]),
      query(`SELECT * FROM social_post_media WHERE post_id = $1`, [id]),
      query(`SELECT * FROM social_post_links WHERE post_id = $1`, [id]),
      query(`SELECT * FROM social_post_captures WHERE post_id = $1`, [id]),
      query(`SELECT * FROM social_post_metrics_snapshots WHERE post_id = $1 ORDER BY snapshot_time DESC`, [id])
    ]);

    sendSuccess(res, {
      post,
      deliveries: delRes.rows,
      media: mediaRes.rows,
      links: linksRes.rows,
      captures: capturesRes.rows,
      metrics_snapshots: metricsRes.rows
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/social/runs
v1Router.get("/social/runs", requireAdminKey, async (req, res, next) => {
  const limit = parseInt(req.query.limit as string, 10) || 50;
  try {
    const dbRes = await query(
      `SELECT id, job_name, run_status, started_at, completed_at, duration_ms, summary_counts, error_message
       FROM social_publishing_runs
       ORDER BY started_at DESC
       LIMIT $1`,
      [limit]
    );

    // Calculate next run time
    const cronPattern = process.env.PUBLISH_CRON_PATTERN || "0 8 * * *";
    const timezone = process.env.PUBLISH_TIMEZONE || "America/New_York";

    const getNextDailyRunTime = (pattern: string, tz: string): Date => {
      const parts = pattern.split(/\s+/);
      let targetHour = 8;
      let targetMinute = 0;
      if (parts.length >= 2) {
        const m = parseInt(parts[0], 10);
        const h = parseInt(parts[1], 10);
        if (!isNaN(m)) targetMinute = m;
        if (!isNaN(h)) targetHour = h;
      }

      const now = new Date();
      const tzString = now.toLocaleString("en-US", { timeZone: tz });
      const localTarget = new Date(tzString);
      localTarget.setHours(targetHour, targetMinute, 0, 0);

      if (localTarget.getTime() <= new Date(tzString).getTime()) {
        localTarget.setDate(localTarget.getDate() + 1);
      }

      const offsetDiff = now.getTime() - new Date(tzString).getTime();
      return new Date(localTarget.getTime() + offsetDiff);
    };

    const nextRun = getNextDailyRunTime(cronPattern, timezone);

    sendSuccess(res, {
      runs: dbRes.rows,
      schedule: {
        next_run: nextRun.toISOString(),
        cron_pattern: cronPattern,
        timezone: timezone
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/social/reconciliation
v1Router.get("/social/reconciliation", requireAdminKey, async (req, res, next) => {
  try {
    let activeUsers = 0;
    const propertyId = process.env.GA4_PROPERTY_ID;
    if (analyticsClient && propertyId) {
      try {
        const [response] = await analyticsClient.runRealtimeReport({
          property: `properties/${propertyId}`,
          metrics: [
            {
              name: "activeUsers",
            },
          ],
        });
        const val = response.rows?.[0]?.metricValues?.[0]?.value;
        if (val) {
          activeUsers = parseInt(val, 10);
        }
      } catch (err) {
        logger.error("[GA4 Data API] Failed to run realtime report for reconciliation:", err);
      }
    }

    const [postsRes, deliveriesRes, capturesRes] = await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM social_posts`),
      query(`
        SELECT 
          COUNT(CASE WHEN status = 'success' THEN 1 END)::int AS success,
          COUNT(CASE WHEN status = 'failed' THEN 1 END)::int AS failed
        FROM social_post_deliveries
      `),
      query(`
        SELECT 
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS success,
          COUNT(CASE WHEN status = 'failed' THEN 1 END)::int AS failed
        FROM social_post_captures
      `)
    ]);

    const totalPosts = postsRes.rows[0]?.count ?? 0;
    const successfulDeliveries = deliveriesRes.rows[0]?.success ?? 0;
    const failedDeliveries = deliveriesRes.rows[0]?.failed ?? 0;
    const totalDeliveries = successfulDeliveries + failedDeliveries;
    const deliverySuccessRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 100;

    const successfulCaptures = capturesRes.rows[0]?.success ?? 0;
    const failedCaptures = capturesRes.rows[0]?.failed ?? 0;
    const totalCaptures = successfulCaptures + failedCaptures;
    const captureSuccessRate = totalCaptures > 0 ? (successfulCaptures / totalCaptures) * 100 : 100;

    sendSuccess(res, {
      internal_metrics: {
        total_posts: totalPosts,
        deliveries: {
          total: totalDeliveries,
          success: successfulDeliveries,
          failed: failedDeliveries,
          success_rate_pct: deliverySuccessRate
        },
        captures: {
          total: totalCaptures,
          success: successfulCaptures,
          failed: failedCaptures,
          success_rate_pct: captureSuccessRate
        }
      },
      ga4_metrics: {
        active_users_realtime: activeUsers
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/social/backfill
// Returns the current backfill backlog count and capture health summary.
v1Router.get("/social/backfill", requireAdminKey, async (_req, res, next) => {
  try {
    const pendingRes = await query(
      `SELECT COUNT(*)::int AS count
       FROM social_post_deliveries d
       LEFT JOIN social_post_captures c
         ON c.delivery_id = d.id
         AND c.capture_type = 'wayback_spn'
         AND c.status = 'completed'
       WHERE d.status = 'success'
         AND d.external_url IS NOT NULL
         AND d.external_url <> ''
         AND c.id IS NULL`
    );

    const captureRes = await query(
      `SELECT
         COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS completed,
         COUNT(CASE WHEN status = 'failed'    THEN 1 END)::int AS failed,
         COUNT(CASE WHEN auth_mode = 'authenticated' THEN 1 END)::int AS authenticated,
         COUNT(CASE WHEN auth_mode = 'anonymous'     THEN 1 END)::int AS anonymous
       FROM social_post_captures
       WHERE capture_type = 'wayback_spn'`
    );

    const c = captureRes.rows[0];
    const total = (c.completed || 0) + (c.failed || 0);
    const successRate = total > 0 ? Math.round((c.completed / total) * 100) : 100;

    sendSuccess(res, {
      backlog: {
        pending_capture_count: pendingRes.rows[0]?.count ?? 0,
        wayback_auth_mode: process.env.WAYBACK_ACCESS_KEY && process.env.WAYBACK_SECRET_KEY
          ? "authenticated"
          : "anonymous",
        crawl_expansion_enabled: process.env.CRAWL_EXPANSION_ENABLED !== "false",
      },
      capture_health: {
        completed: c.completed || 0,
        failed: c.failed || 0,
        success_rate_pct: successRate,
        authenticated_captures: c.authenticated || 0,
        anonymous_captures: c.anonymous || 0,
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/social/backfill
// Triggers one batch of Wayback SPN capture backfill jobs.
v1Router.post("/social/backfill", requireAdminKey, async (req, res, next) => {
  const batchSize = parseInt((req.body?.batch_size as string) || process.env.BACKFILL_BATCH_SIZE || "25", 10);

  try {
    const eligibleRes = await query(
      `SELECT d.id, d.post_id, d.external_url
       FROM social_post_deliveries d
       LEFT JOIN social_post_captures c
         ON c.delivery_id = d.id
         AND c.capture_type = 'wayback_spn'
         AND c.status = 'completed'
       WHERE d.status = 'success'
         AND d.external_url IS NOT NULL
         AND d.external_url <> ''
         AND c.id IS NULL
       ORDER BY d.created_at ASC
       LIMIT $1`,
      [batchSize]
    );

    if (eligibleRes.rows.length === 0) {
      return sendSuccess(res, { enqueued: 0, message: "No deliveries pending capture." });
    }

    const waybackQueue = new Queue("wayback-spn", {
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
      }
    });

    let enqueued = 0;
    let skipped = 0;
    for (const row of eligibleRes.rows) {
      const jobId = `wayback-spn-del-${row.id}`;
      try {
        await waybackQueue.add(
          "archive",
          { url: row.external_url, postId: row.post_id, deliveryId: row.id },
          { jobId, attempts: 5, backoff: { type: "exponential", delay: 15000 } }
        );
        enqueued++;
      } catch (err: any) {
        if (err.message?.includes("already exists")) {
          skipped++;
        } else {
          logger.warn(`[BackfillAPI] Could not enqueue delivery ${row.id}: ${err.message}`);
          skipped++;
        }
      }
    }

    await waybackQueue.close();

    sendSuccess(res, {
      enqueued,
      skipped,
      batch_size: batchSize,
      message: `Enqueued ${enqueued} Wayback SPN capture job(s).`
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/social/captures/retry-failed
// Re-enqueue all failed Wayback SPN captures.
v1Router.post("/social/captures/retry-failed", requireAdminKey, async (_req, res, next) => {
  try {
    const failedRes = await query(
      `SELECT c.id, c.post_id, c.delivery_id, d.external_url
       FROM social_post_captures c
       JOIN social_post_deliveries d ON d.id = c.delivery_id
       WHERE c.capture_type = 'wayback_spn'
         AND c.status = 'failed'
         AND d.external_url IS NOT NULL
         AND d.external_url <> ''
       ORDER BY c.captured_at ASC
       LIMIT 50`
    );

    if (failedRes.rows.length === 0) {
      return sendSuccess(res, { enqueued: 0, message: "No failed captures found to retry." });
    }

    const waybackQueue = new Queue("wayback-spn", { connection: redisConnection });
    let enqueued = 0;
    for (const cap of failedRes.rows) {
      const jobId = `wayback-spn-cap-${cap.id}-retry-${Date.now()}`;
      try {
        await waybackQueue.add(
          "archive",
          { url: cap.external_url, postId: cap.post_id, deliveryId: cap.delivery_id },
          { jobId, attempts: 5, backoff: { type: "exponential", delay: 15000 } }
        );
        enqueued++;
      } catch {
        // Skip duplicates
      }
    }
    await waybackQueue.close();

    logger.info(`[Commander] Retried ${enqueued} failed Wayback captures.`);
    sendSuccess(res, { enqueued, message: `${enqueued} failed archive capture(s) re-queued for retry.` });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/social/publish-now
// Force-trigger a micro-edition publish run immediately.
v1Router.post("/social/publish-now", requireAdminKey, async (req, res, next) => {
  try {
    // Create a pending run record
    const runRes = await query(
      `INSERT INTO social_publishing_runs (job_name, run_status, started_at, trigger_source)
       VALUES ('micro_edition_publish', 'pending', NOW(), 'manual')
       RETURNING id`
    );
    const runId = runRes.rows[0].id;

    // Enqueue immediately — job picks it up and runs the script
    const schedulerQueue = new Queue("social-scheduler", { connection: redisConnection });
    await schedulerQueue.add(
      "micro-edition-publish",
      { runId, triggeredBy: "force_publish" },
      { attempts: 1 }
    );
    await schedulerQueue.close();

    logger.info(`[Commander] Force-publish triggered as run ${runId}.`);
    sendSuccess(res, { triggered: true, run_id: runId, message: `Publishing run #${runId} queued. Worker will pick it up within seconds.` });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/system/readiness
// Returns a readiness matrix for all production integrations.
v1Router.get("/system/readiness", requireAdminKey, async (_req, res, next) => {
  try {
    // Check DB migration level
    let latestMigration = "unknown";
    try {
      const mRes = await query("SELECT migration_name FROM schema_migrations ORDER BY applied_at DESC LIMIT 1");
      if (mRes.rows.length > 0) latestMigration = mRes.rows[0].migration_name;
    } catch { /* table may not exist yet */ }

    // Check recent runs
    let lastRunStatus: string | null = null;
    let lastRunAt: string | null = null;
    try {
      const rRes = await query(
        "SELECT run_status, completed_at FROM social_publishing_runs ORDER BY started_at DESC LIMIT 1"
      );
      if (rRes.rows.length > 0) {
        lastRunStatus = rRes.rows[0].run_status;
        lastRunAt = rRes.rows[0].completed_at;
      }
    } catch { /* table may not exist */ }

    const env = process.env;

    const integrations = [
      {
        name: "Publishing credentials",
        category: "social",
        status: (env.MASTODON_ACCESS_TOKEN || env.NOSTR_PRIVATE_KEY || env.BLUESKY_PASSWORD) ? "partial" : "blocked",
        configured: [
          env.MASTODON_ACCESS_TOKEN ? "Mastodon" : null,
          env.NOSTR_PRIVATE_KEY ? "Nostr" : null,
          env.BLUESKY_PASSWORD ? "Bluesky" : null,
        ].filter(Boolean),
        missing: [
          !env.MASTODON_ACCESS_TOKEN ? "MASTODON_ACCESS_TOKEN" : null,
          !env.NOSTR_PRIVATE_KEY ? "NOSTR_PRIVATE_KEY" : null,
          !env.BLUESKY_PASSWORD ? "BLUESKY_PASSWORD (or BLUESKY_IDENTIFIER)" : null,
        ].filter(Boolean),
        remediation: "Add platform credentials to .env to enable social publishing.",
      },
      {
        name: "Archive credentials",
        category: "archive",
        status: (env.WAYBACK_ACCESS_KEY && env.WAYBACK_SECRET_KEY) ? "ready" : "partial",
        configured: env.WAYBACK_ACCESS_KEY ? ["Wayback Machine (authenticated)"] : [],
        missing: (!env.WAYBACK_ACCESS_KEY || !env.WAYBACK_SECRET_KEY) ? ["WAYBACK_ACCESS_KEY", "WAYBACK_SECRET_KEY"] : [],
        remediation: "Get S3 credentials from https://archive.org/account/s3.php and add to .env.",
        archive_mode: (env.WAYBACK_ACCESS_KEY && env.WAYBACK_SECRET_KEY) ? "authenticated" : "anonymous",
      },
      {
        name: "Admin authentication",
        category: "security",
        status: env.ADMIN_API_KEY ? "ready" : "blocked",
        configured: env.ADMIN_API_KEY ? ["Admin key set"] : [],
        missing: !env.ADMIN_API_KEY ? ["ADMIN_API_KEY"] : [],
        remediation: "Generate a strong random key and set ADMIN_API_KEY in .env.",
      },
      {
        name: "Analytics — Measurement Protocol",
        category: "analytics",
        status: (env.GA4_MEASUREMENT_ID && env.GA4_API_SECRET) ? "ready" : "blocked",
        configured: [
          env.GA4_MEASUREMENT_ID ? `Measurement ID: ${env.GA4_MEASUREMENT_ID}` : null,
          env.GA4_API_SECRET ? "API Secret: set" : null,
        ].filter(Boolean),
        missing: [
          !env.GA4_MEASUREMENT_ID ? "GA4_MEASUREMENT_ID" : null,
          !env.GA4_API_SECRET ? "GA4_API_SECRET" : null,
        ].filter(Boolean),
        remediation: "See ops/analytics-setup.md: Admin → Data Streams → [stream] → Measurement Protocol API secrets.",
      },
      {
        name: "Analytics — Data API (dashboard)",
        category: "analytics",
        status: env.GA4_PROPERTY_ID ? "ready" : "partial",
        configured: env.GA4_PROPERTY_ID ? [`Property: ${env.GA4_PROPERTY_ID}`] : [],
        missing: !env.GA4_PROPERTY_ID ? ["GA4_PROPERTY_ID"] : [],
        remediation: "See ops/analytics-setup.md: Admin → Property Settings → copy numeric Property ID, prefix with 'properties/'.",
      },
      {
        name: "Scheduler",
        category: "infrastructure",
        status: env.PUBLISH_CRON_PATTERN ? "ready" : "partial",
        configured: env.PUBLISH_CRON_PATTERN ? [`Cron: ${env.PUBLISH_CRON_PATTERN} (${env.PUBLISH_TIMEZONE || "UTC"})`] : [],
        missing: !env.PUBLISH_CRON_PATTERN ? ["PUBLISH_CRON_PATTERN", "PUBLISH_TIMEZONE"] : [],
        remediation: "Set PUBLISH_CRON_PATTERN (e.g. '0 8 * * *') and PUBLISH_TIMEZONE in .env, then restart the federation worker.",
      },
      {
        name: "Lightning / Value-for-Value",
        category: "payments",
        status: env.LIGHTNING_ADDRESS ? "ready" : "blocked",
        configured: env.LIGHTNING_ADDRESS ? [`Lightning: ${env.LIGHTNING_ADDRESS}`] : [],
        missing: !env.LIGHTNING_ADDRESS ? ["LIGHTNING_ADDRESS"] : [],
        remediation: "Add LIGHTNING_ADDRESS (e.g. yourname@phoenixwallet.me) and optionally BOLT12_OFFER.",
      },
      {
        name: "Production database migrations",
        category: "infrastructure",
        status: latestMigration !== "unknown" ? "ready" : "partial",
        configured: [`Latest migration: ${latestMigration}`],
        missing: [],
        remediation: "Run scripts/apply-migration.ts to ensure all migrations are applied.",
      },
      {
        name: "Newsletter generation",
        category: "newsletter",
        status: env.GEMINI_API_KEY ? "ready" : "blocked",
        configured: env.GEMINI_API_KEY ? ["Gemini API key set"] : [],
        missing: !env.GEMINI_API_KEY ? ["GEMINI_API_KEY"] : [],
        remediation: "Add GEMINI_API_KEY from Google AI Studio (aistudio.google.com). Required for compile-edition.ts and generate-daily-newsletter.ts.",
      },
      {
        name: "Email delivery",
        category: "newsletter",
        status: env.RESEND_API_KEY ? "ready" : "partial",
        configured: env.RESEND_API_KEY ? ["Resend API key set"] : [],
        missing: !env.RESEND_API_KEY ? ["RESEND_API_KEY"] : [],
        remediation: "Add RESEND_API_KEY from resend.com. Required for subscriber email broadcast. Web publish works without it.",
      },
    ];

    const readyCount = integrations.filter((i) => i.status === "ready").length;
    const blockedCount = integrations.filter((i) => i.status === "blocked").length;
    const publishReady = integrations
      .filter((i) => i.category === "social" || i.category === "archive" || i.category === "newsletter")
      .every((i) => i.status !== "blocked");

    sendSuccess(res, {
      publish_ready: publishReady,
      summary: { ready: readyCount, partial: integrations.filter((i) => i.status === "partial").length, blocked: blockedCount, total: integrations.length },
      last_run: { status: lastRunStatus, completed_at: lastRunAt },
      integrations,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/system/scheduler
// Returns BullMQ scheduler state, all ingest/publishing queue metrics, and recent run history.
v1Router.get("/system/scheduler", requireAdminKey, async (_req, res, next) => {
  try {
    const schedulerQueue    = new Queue("social-scheduler",  { connection: redisConnection });
    const waybackQueue      = new Queue("wayback-spn",        { connection: redisConnection });
    const entityExtractQueue = new Queue("entity_extraction", { connection: redisConnection });
    const feedValidQueue    = new Queue("feed_validation",    { connection: redisConnection });
    const apOutboundQueue   = new Queue("activitypub-outbound", { connection: redisConnection });

    // Helper: compute queue health badge
    type QueueHealth = "healthy" | "degraded" | "stalled";
    async function getQueueMetrics(q: Queue, label: string): Promise<{
      name: string;
      label: string;
      waiting: number;
      active: number;
      completed_recent: number;
      failed_recent: number;
      oldest_waiting_ms: number | null;
      health: QueueHealth;
    }> {
      const [waiting, active, failed, completed, waitingJobs] = await Promise.all([
        q.getWaitingCount().catch(() => 0),
        q.getActiveCount().catch(() => 0),
        q.getFailedCount().catch(() => 0),
        q.getCompletedCount().catch(() => 0),
        q.getWaiting(0, 0).catch(() => []),   // fetch oldest 1 job
      ]);

      const oldestMs = waitingJobs[0]?.timestamp ? Date.now() - waitingJobs[0].timestamp : null;
      const health: QueueHealth =
        oldestMs !== null && oldestMs > 60 * 60 * 1000   ? "stalled"   // oldest waiting > 1 hour
        : failed > 10                                      ? "degraded"  // more than 10 failures
        : "healthy";

      return {
        name: (q as any).name,
        label,
        waiting,
        active,
        completed_recent: completed,
        failed_recent: failed,
        oldest_waiting_ms: oldestMs,
        health,
      };
    }

    const [
      schedulerMetrics,
      waybackMetrics,
      entityExtractMetrics,
      feedValidMetrics,
      apOutboundMetrics,
      repeatableJobs,
    ] = await Promise.all([
      getQueueMetrics(schedulerQueue,    "Social scheduler"),
      getQueueMetrics(waybackQueue,      "Wayback archive"),
      getQueueMetrics(entityExtractQueue, "Entity extraction"),
      getQueueMetrics(feedValidQueue,    "Feed validation"),
      getQueueMetrics(apOutboundQueue,   "ActivityPub outbound"),
      schedulerQueue.getRepeatableJobs().catch(() => []),
    ]);

    await Promise.all([
      schedulerQueue.close(),
      waybackQueue.close(),
      entityExtractQueue.close(),
      feedValidQueue.close(),
      apOutboundQueue.close(),
    ]);

    // Recent run history from DB
    const runsRes = await query(
      `SELECT id, job_name, run_status, started_at, completed_at, duration_ms, trigger_source, error_message, summary_counts
       FROM social_publishing_runs
       ORDER BY started_at DESC
       LIMIT 10`
    );

    const nextJob = repeatableJobs[0];
    const nextRun = nextJob?.next ? new Date(nextJob.next).toISOString() : null;

    sendSuccess(res, {
      scheduler: {
        cron_pattern: process.env.PUBLISH_CRON_PATTERN || null,
        timezone: process.env.PUBLISH_TIMEZONE || "UTC",
        next_run: nextRun,
        repeatable_jobs: repeatableJobs.map((j) => ({ name: j.name, pattern: j.pattern, tz: j.tz, next: j.next ? new Date(j.next).toISOString() : null })),
        crawl_expansion_enabled: process.env.CRAWL_EXPANSION_ENABLED !== "false",
      },
      queues: [
        schedulerMetrics,
        waybackMetrics,
        entityExtractMetrics,
        feedValidMetrics,
        apOutboundMetrics,
      ],
      recent_runs: runsRes.rows,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/admin/processing/stats
v1Router.get("/admin/processing/stats", requireAdminKey, async (_req, res, next) => {
  try {
    const processedTodayRes = await query(`
      SELECT COUNT(*)::int AS count
      FROM article_links
      WHERE relevance_checked_at >= CURRENT_DATE 
        AND relevance_score IS NOT NULL
    `);

    const backlogRes = await query(`
      SELECT COUNT(*)::int AS count
      FROM article_links
      WHERE relevance_score IS NULL 
        AND is_suppressed = false
    `);

    const failedRes = await query(`
      SELECT COUNT(*)::int AS count
      FROM article_links
      WHERE is_suppressed = true
    `);

    const totalsRes = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE processing_lane = 'historical')::int AS historical,
        COUNT(*) FILTER (WHERE processing_lane = 'current')::int AS current,
        COUNT(*) FILTER (WHERE processing_lane = 'historical' AND relevance_score IS NOT NULL)::int AS historical_processed,
        COUNT(*) FILTER (WHERE processing_lane = 'current' AND relevance_score IS NOT NULL)::int AS current_processed
      FROM article_links
    `);

    // Fetch actual spend from gemini_usage_log if available
    const spendRes = await query(`
      SELECT SUM(estimated_cost_usd)::float8 AS total_spend
      FROM gemini_usage_log
    `);

    const stats = {
      processed_today: processedTodayRes.rows[0]?.count || 0,
      backlog: backlogRes.rows[0]?.count || 0,
      failed: failedRes.rows[0]?.count || 0,
      lanes: {
        historical_total: totalsRes.rows[0]?.historical || 0,
        current_total: totalsRes.rows[0]?.current || 0,
        historical_processed: totalsRes.rows[0]?.historical_processed || 0,
        current_processed: totalsRes.rows[0]?.current_processed || 0,
        // Proxies for cost allocation by lane
        historical_spend_proxy_usd: (totalsRes.rows[0]?.historical_processed || 0) * 0.000027,
        current_spend_proxy_usd: (totalsRes.rows[0]?.current_processed || 0) * 0.000027,
      },
      total_usage_spend_usd: spendRes.rows[0]?.total_spend || 0,
    };

    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/admin/processing/controls
v1Router.get("/admin/processing/controls", requireAdminKey, async (_req, res, next) => {
  try {
    const dbRes = await query(
      `SELECT max_items_per_run, daily_cap, pause_historical, low_spend_mode
       FROM processing_controls
       WHERE id = 'default'`
    );
    sendSuccess(res, dbRes.rows[0] || {});
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/admin/processing/controls
v1Router.post("/admin/processing/controls", requireAdminKey, async (req, res, next) => {
  const { max_items_per_run, daily_cap, pause_historical, low_spend_mode } = req.body;
  try {
    const dbRes = await query(
      `UPDATE processing_controls
       SET max_items_per_run = COALESCE($1, max_items_per_run),
           daily_cap = COALESCE($2, daily_cap),
           pause_historical = COALESCE($3, pause_historical),
           low_spend_mode = COALESCE($4, low_spend_mode),
           updated_at = NOW()
       WHERE id = 'default'
       RETURNING max_items_per_run, daily_cap, pause_historical, low_spend_mode`,
      [
        max_items_per_run !== undefined ? parseInt(max_items_per_run, 10) : null,
        daily_cap !== undefined ? parseInt(daily_cap, 10) : null,
        pause_historical !== undefined ? !!pause_historical : null,
        low_spend_mode !== undefined ? !!low_spend_mode : null
      ]
    );
    sendSuccess(res, { message: "Processing controls updated successfully.", controls: dbRes.rows[0] });
  } catch (error) {
    next(error);
  }
});


