/**
 * apps/api/src/lib/dedupe.ts
 * Shared URL normalization and deduplication utilities.
 * Used by both the API (webhook handler) and the ingest worker.
 */
import crypto from "crypto";
import { Pool } from "pg";

const dbPool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Strip UTM tracking params, normalize trailing slashes.
 * Returns the cleaned URL string.
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const drop = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "source", "fbclid", "gclid"];
    drop.forEach((k) => u.searchParams.delete(k));
    let clean = u.toString();
    if (clean.endsWith("/")) clean = clean.slice(0, -1);
    return clean;
  } catch {
    return rawUrl.trim();
  }
}

/** SHA-256 hash of a normalized URL — used as the unique key in article_links */
export function generateUrlHash(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex");
}

/** Returns true if the url_hash already exists in article_links */
export async function isUrlDiscovered(urlHash: string): Promise<boolean> {
  const res = await dbPool.query(
    "SELECT 1 FROM article_links WHERE url_hash = $1",
    [urlHash]
  );
  return (res.rowCount ?? 0) > 0;
}
