/**
 * Script: archive-sailboatdata.ts
 * Purpose: Scrape a SailboatData page, hash its markup, extract media, and archive it honoring copyright flags.
 * Idempotent: Yes - upserts records on conflict.
 * Usage: npx tsx scripts/archive-sailboatdata.ts <sailboatdata-url>
 */

import * as cheerio from "cheerio";
import crypto from "crypto";
import { query, closePool } from "./lib/db";

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Error: Missing target URL.");
    console.error("Usage: npx tsx scripts/archive-sailboatdata.ts <sailboatdata-url>");
    process.exit(1);
  }

  console.log(`[Archive] Initiating crawl for: ${url}`);

  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };

    let html = "";
    let method = "direct_http_fetch";
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`HTTP status ${res.status}`);
      }
      html = await res.text();
    } catch (err: any) {
      console.warn(`[Archive] Direct live fetch failed: ${err.message}. Retrying via Wayback Machine...`);
      const slugPart = url.split("/sailboat/")[1] || url.split("/").pop() || "";
      const archiveUrl = `https://web.archive.org/web/2025/https://sailboatdata.com/sailboat/${slugPart}`;
      console.log(`[Archive] Fetching from archive: ${archiveUrl}`);
      const archiveRes = await fetch(archiveUrl, { headers });
      if (!archiveRes.ok) {
        throw new Error(`Wayback fallback failed with status ${archiveRes.status} for URL: ${archiveUrl}`);
      }
      html = await archiveRes.text();
      method = "wayback_machine_fallback";
    }
    console.log(`[Archive] HTML content successfully retrieved via ${method} (${html.length} bytes).`);

    // 1. Compute checksum
    const checksum = crypto.createHash("sha256").update(html).digest("hex");
    console.log(`[Archive] SHA-256 markup checksum: ${checksum}`);

    // 2. Parse HTML and extract images
    const $ = cheerio.load(html);
    const mediaUrls: string[] = [];
    $("img").each((_, img) => {
      const src = $(img).attr("src");
      if (src) {
        try {
          const absoluteUrl = new URL(src, url).toString();
          if (!mediaUrls.includes(absoluteUrl)) {
            mediaUrls.push(absoluteUrl);
          }
        } catch {
          // ignore invalid urls
        }
      }
    });

    console.log(`[Archive] Extracted ${mediaUrls.length} image reference URLs.`);

    // 3. Define licensing and provenance
    const rightsFlags = {
      allow_display: false, // Strict copyright limit: store internally but do not display
      license: "fair_use_non_commercial"
    };

    const provenanceInfo = {
      retrieved_at: new Date().toISOString(),
      method,
      user_agent: headers["User-Agent"],
      checksum
    };

    // 4. Insert / Update database record
    await query(
      `INSERT INTO sailboatdata_archives (source_url, page_html, content_hash, rights_flags, internal_media_urls, provenance_info)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)
       ON CONFLICT (source_url) DO UPDATE
       SET page_html = EXCLUDED.page_html,
           content_hash = EXCLUDED.content_hash,
           rights_flags = EXCLUDED.rights_flags,
           internal_media_urls = EXCLUDED.internal_media_urls,
           provenance_info = EXCLUDED.provenance_info,
           created_at = NOW()`,
      [
        url,
        html,
        checksum,
        JSON.stringify(rightsFlags),
        JSON.stringify(mediaUrls),
        JSON.stringify(provenanceInfo)
      ]
    );

    console.log(`[Archive] Successfully ingested and archived record in sailboatdata_archives.`);
  } catch (err: any) {
    console.error(`[Archive Error] Crawl/Ingest failed: ${err.message}`);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
