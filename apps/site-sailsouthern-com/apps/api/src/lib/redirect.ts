import { logger } from "@stax/logger";
/**
 * apps/api/src/lib/redirect.ts
 *
 * Redirect System — Sprint 9A
 *
 * LINK DOCTRINE: All outbound article links use /sendit/<hash>.
 * OG images served direct from source URL — no redirect.
 *
 * hash = 8-char base62 derived deterministically from the article UUID's
 * integer representation (last 6 bytes → BigInt → base62 → padded to 8 chars).
 */

import crypto from "crypto";
import { query } from "./db";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Convert a positive BigInt to a base62 string, padded to `len` chars. */
function toBase62(n: bigint, len = 8): string {
  const base = BigInt(62);
  let result = "";
  let x = n < 0n ? -n : n; // abs — IDs are always positive
  while (x > 0n) {
    result = BASE62[Number(x % base)] + result;
    x = x / base;
  }
  return result.padStart(len, "0").slice(-len);
}

/**
 * Deterministic 8-char base62 hash for an article UUID.
 * Takes the last 8 hex chars of the UUID (32-bit suffix), converts to BigInt.
 * Collision probability at 100k articles: ~0.03% — acceptable.
 */
export function buildRedirectHash(articleId: string): string {
  // UUID hex without dashes, last 12 hex chars = 48-bit space
  const hex = articleId.replace(/-/g, "").slice(-12);
  const n = BigInt("0x" + hex);
  return toBase62(n, 8);
}

/**
 * Resolve a redirect hash to its canonical URL.
 * Returns null if not found.
 */
export async function resolveRedirectHash(
  hash: string
): Promise<{ canonicalUrl: string; articleLinkId: string } | null> {
  const res = await query(
    `SELECT article_link_id, canonical_url FROM redirect_links WHERE hash = $1 LIMIT 1`,
    [hash]
  );
  if (!res.rows[0]) return null;
  return {
    canonicalUrl: res.rows[0].canonical_url,
    articleLinkId: res.rows[0].article_link_id,
  };
}

/**
 * Ensure a redirect_links row exists for this article.
 * Also writes redirect_hash back to article_links.
 * Idempotent — safe to call multiple times.
 */
export async function ensureRedirectLink(
  articleId: string,
  canonicalUrl: string
): Promise<string> {
  const hash = buildRedirectHash(articleId);

  await query(
    `INSERT INTO redirect_links (hash, article_link_id, canonical_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (hash) DO NOTHING`,
    [hash, articleId, canonicalUrl]
  );

  await query(
    `UPDATE article_links SET redirect_hash = $1 WHERE id = $2 AND redirect_hash IS NULL`,
    [hash, articleId]
  );

  return hash;
}

/**
 * Fire-and-forget click logging — never throws, never blocks the redirect.
 */
export function logRedirectClick(opts: {
  articleLinkId: string;
  hash: string;
  source?: string;
  subscriberId?: number | null;
  utmMedium?: string | null;
  ipRaw?: string | null;
  referrer?: string | null;
}): void {
  const ipHash = opts.ipRaw
    ? crypto.createHash("sha256").update(opts.ipRaw).digest("hex")
    : null;

  // Async increment click_count on article_links
  query(
    `UPDATE article_links SET click_count = click_count + 1 WHERE id = $1`,
    [opts.articleLinkId]
  ).catch((e) => logger.error("[redirect] click_count increment failed:", e));

  // Log the click row
  query(
    `INSERT INTO redirect_clicks
       (article_link_id, redirect_hash, source, subscriber_id, utm_medium, ip_hash, referrer)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      opts.articleLinkId,
      opts.hash,
      opts.source ?? "web",
      opts.subscriberId ?? null,
      opts.utmMedium ?? null,
      ipHash,
      opts.referrer ?? null,
    ]
  ).catch((e) => logger.error("[redirect] click log failed:", e));
}
