/**
 * Script: enrich-og-images.ts
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
  console.log("[enrich-og-images] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const LIMIT = parseInt(process.argv.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "200");
const CONCURRENCY = parseInt(process.argv.find(a => a.startsWith("--concurrency="))?.split("=")[1] ?? "5");
const TIMEOUT_MS = 8000;

/** Fetch just the <head> of a page and extract og:image. Returns null if not found or error. */
async function scrapeOgImage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "SailSouthernBot/1.0 (+https://sailsouthern.com/bot)",
        "Accept": "text/html",
      },
    });

    if (!resp.ok) return null;

    // Stream only first 32 KB to keep it cheap
    const reader = resp.body?.getReader();
    if (!reader) return null;

    let chunk = "";
    let bytesRead = 0;

    while (bytesRead < 32_768) {
      const { done, value } = await reader.read();
      if (done) break;
      chunk += new TextDecoder().decode(value);
      bytesRead += value.byteLength;
      // Stop once we've seen </head>
      if (chunk.includes("</head>") || chunk.includes("<body")) break;
    }

    reader.cancel();

    // Extract og:image
    const match = chunk.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                 ?? chunk.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    if (match?.[1]) {
      const imgUrl = match[1].trim();
      // Basic validation — must look like a URL
      if (imgUrl.startsWith("http")) return imgUrl;
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  const res = await pool.query(
    `SELECT id, canonical_url, url_hash
     FROM article_links
     WHERE og_image_scraped_at IS NULL
       AND is_suppressed = false
       AND relevance_score >= 0.3
     ORDER BY relevance_score DESC NULLS LAST
     LIMIT $1`,
    [LIMIT]
  );

  const rows: { id: string; canonical_url: string; url_hash: string }[] = res.rows;
  console.log(`[OG Enricher] Processing ${rows.length} articles (limit=${LIMIT}, concurrency=${CONCURRENCY})...`);

  let done = 0;
  let found = 0;

  // Simple concurrency pool
  async function processRow(row: typeof rows[0]) {
    const ogUrl = await scrapeOgImage(row.canonical_url);

    await pool.query(
      `UPDATE article_links
          SET og_image_url = $1, og_image_scraped_at = NOW()
        WHERE id = $2`,
      [ogUrl, row.id]
    );

    done++;
    if (ogUrl) found++;

    if (done % 25 === 0 || done === rows.length) {
      console.log(`[OG Enricher] ${done}/${rows.length} processed — ${found} OG images found`);
    }
  }

  // Process in batches of CONCURRENCY
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(processRow));
  }

  console.log(`[OG Enricher] ✅ Done. ${found}/${rows.length} articles now have OG images.`);
  await pool.end();
}

run().catch((err) => {
  console.error("[OG Enricher] Fatal error:", err);
  process.exit(1);
});