/**
 * Script: backfill-og-images.ts
 * Purpose: Operational run script.
 * Idempotent: Yes
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import dotenv from "dotenv";
dotenv.config();
import { Pool } from "pg";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[backfill-og-images] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BATCH       = parseInt(process.argv.find(a => a.startsWith("--batch="))?.split("=")[1] ?? "500");
const CONCURRENCY = parseInt(process.argv.find(a => a.startsWith("--concurrency="))?.split("=")[1] ?? "5");
const TIMEOUT_MS  = 3000;

async function scrapeOgImage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "SailSouthernBot/1.0 (+https://sailsouthern.com/bot)",
        Accept: "text/html",
      },
    });
    if (!resp.ok) return null;

    const reader = resp.body?.getReader();
    if (!reader) return null;

    let chunk = "";
    let bytesRead = 0;

    while (bytesRead < 32_768) {
      const { done, value } = await reader.read();
      if (done) break;
      chunk += new TextDecoder().decode(value);
      bytesRead += value.byteLength;
      if (chunk.includes("</head>") || chunk.includes("<body")) break;
    }
    reader.cancel();

    // Try both attribute orderings
    const m =
      chunk.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      chunk.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    const imgUrl = m?.[1]?.trim();
    return imgUrl?.startsWith("http") ? imgUrl : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  const res = await pool.query<{ id: string; canonical_url: string }>(
    `SELECT id, canonical_url
     FROM article_links
     WHERE og_image_url IS NULL
       AND is_suppressed = false
       AND relevance_score >= 0.3
     ORDER BY relevance_score DESC NULLS LAST
     LIMIT $1`,
    [BATCH]
  );

  const rows = res.rows;
  console.log(`[OGBackfill] Processing ${rows.length} articles (batch=${BATCH}, concurrency=${CONCURRENCY})...`);

  let done = 0;
  let found = 0;

  async function processRow(row: { id: string; canonical_url: string }) {
    const ogUrl = await scrapeOgImage(row.canonical_url);
    await pool.query(
      `UPDATE article_links SET og_image_url = $1, og_image_scraped_at = NOW() WHERE id = $2`,
      [ogUrl, row.id]
    );
    done++;
    if (ogUrl) found++;
    if (done % 50 === 0 || done === rows.length) {
      console.log(`[OGBackfill] ${done}/${rows.length} — ${found} images found`);
    }
  }

  // Concurrency pool
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    await Promise.all(rows.slice(i, i + CONCURRENCY).map(processRow));
  }

  console.log(`[OGBackfill] ✅ Done. ${found}/${rows.length} articles now have OG images.`);
  await pool.end();
}

run().catch(err => {
  console.error("[OGBackfill] Fatal error:", err);
  process.exit(1);
});