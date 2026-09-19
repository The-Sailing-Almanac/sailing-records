import * as cheerio from "cheerio";
import { Pool } from "pg";
import { logger } from "@stax/logger";
import { normalizeUnits } from "@stax/rig-db";

export interface ParsedBoatData {
  model_name: string;
  builder_name?: string | null;
  designer_name?: string | null;
  year_start?: number | null;
  year_end?: number | null;
  hull_type?: string | null;
  rig_type?: string | null;
  loa?: string | null;
  lwl?: string | null;
  beam?: string | null;
  draft?: string | null;
  displacement?: string | null;
  ballast?: string | null;
  sail_area_main?: string | null;
  sail_area_jib?: string | null;
  sail_area_spinnaker?: string | null;
  upwind_sa_m2?: string | null;
  downwind_sa_m2?: string | null;
  rig_description?: string | null;
  [key: string]: any;
}

/**
 * Parses sailboatdata HTML using Cheerio to extract specs.
 * Avoids copyrighted descriptions or images—strictly extracts labels, dimensions, and metadata.
 */
export function parseSailboatDataHtml(html: string): ParsedBoatData {
  const $ = cheerio.load(html);

  // Model name is typically in h1
  let modelName = $(".boats-dimension h1").text().trim() || $("h1").first().text().trim();
  if (!modelName) {
    modelName = "Unknown";
  }

  const payload: ParsedBoatData = {
    model_name: modelName,
  };

  // Find all key-value cells in the tables
  $("tr").each((_, row) => {
    const tds = $(row).find("td");
    if (tds.length === 2) {
      const rawKey = $(tds[0]).text().trim();
      const val = $(tds[1]).text().trim();

      // Normalize key (e.g. "LOA:" -> "loa")
      const keyClean = rawKey.replace(/:$/, "").trim().toLowerCase();

      if (!keyClean || !val) return;

      if (keyClean === "hull type") {
        payload.hull_type = val;
      } else if (keyClean === "rigging type" || keyClean === "rig type") {
        payload.rig_type = val;
      } else if (keyClean === "loa") {
        payload.loa = val;
      } else if (keyClean === "lwl") {
        payload.lwl = val;
      } else if (keyClean === "beam") {
        payload.beam = val;
      } else if (keyClean === "displacement") {
        payload.displacement = val;
      } else if (keyClean === "ballast") {
        payload.ballast = val;
      } else if (keyClean === "max draft" || keyClean === "draft") {
        payload.draft = val;
      } else if (keyClean === "first built") {
        payload.year_start = parseInt(val, 10) || null;
      } else if (keyClean === "last built") {
        payload.year_end = parseInt(val, 10) || null;
      } else if (keyClean === "s.a. main") {
        payload.sail_area_main = val;
      } else if (keyClean === "s.a. (reported)") {
        payload.upwind_sa_m2 = val;
      } else if (keyClean === "s.a. fore" || keyClean === "s.a. jib") {
        payload.sail_area_jib = val;
      } else if (keyClean === "s.a. spinnaker" || keyClean === "s.a. spin") {
        payload.sail_area_spinnaker = val;
      } else if (keyClean === "builders" || keyClean === "builder") {
        payload.builder_name = $(tds[1]).find("a").text().trim() || val;
      } else if (keyClean === "designers" || keyClean === "designer") {
        payload.designer_name = $(tds[1]).find("a").text().trim() || val;
      } else {
        // Store any other table key as is
        const safeKey = keyClean.replace(/[^a-z0-9_]+/g, "_");
        payload[safeKey] = val;
      }
    }
  });

  return payload;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Scrapes a sailboatdata detail page, normalizes specifications,
 * and records raw payloads & canonical boat records.
 */
export async function scrapeBoatPage(url: string, dbPool: Pool): Promise<void> {
  logger.info(`[RigScraper] Starting ingest for URL: ${url}`);

  // Random polite crawl jitter: 5-10s
  const sleepMs = 5000 + Math.random() * 5000;
  logger.info(`[RigScraper] Sleeping for ${Math.round(sleepMs / 100) / 10}s to respect rate limits...`);
  await sleep(sleepMs);

  let html = "";
  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };

    logger.info(`[RigScraper] Fetching live: ${url}`);
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    html = await res.text();
  } catch (err: any) {
    logger.warn(`[RigScraper] Live fetch failed for ${url} (${err.message}). Falling back to Wayback Machine...`);
    const archiveUrl = `https://web.archive.org/web/https://sailboatdata.com/sailboat/${url.split("/sailboat/")[1]}`;
    
    // Polite delay before fallback
    await sleep(2000);
    const archiveRes = await fetch(archiveUrl);
    if (!archiveRes.ok) {
      throw new Error(`Fallback Wayback URL failed with status ${archiveRes.status} for ${archiveUrl}`);
    }
    html = await archiveRes.text();
  }

  const rawPayload = parseSailboatDataHtml(html);
  if (!rawPayload.model_name || rawPayload.model_name === "Unknown") {
    throw new Error(`Failed to parse model name from HTML of URL: ${url}`);
  }

  // Normalize parsed payload
  const norm = normalizeUnits(rawPayload);

  // Database Transactions
  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");

    // 1. Check if source already exists
    const sourceRes = await client.query(
      `SELECT boat_id FROM boat_sources WHERE source_url = $1 LIMIT 1`,
      [url]
    );

    let boatId: number;

    if (sourceRes.rows.length > 0) {
      boatId = sourceRes.rows[0].boat_id;
      
      // Update existing boat specs in boats table
      await client.query(
        `UPDATE boats
         SET builder_name = $1, model_name = $2, variant_name = $3, year_start = $4, year_end = $5,
             hull_type = $6, rig_type = $7, displacement_kg = $8, ballast_kg = $9, loa_m = $10,
             lwl_m = $11, beam_m = $12, draft_m = $13, sail_area_main_m2 = $14, sail_area_jib_m2 = $15,
             sail_area_spinnaker_m2 = $16, upwind_sa_m2 = $17, downwind_sa_m2 = $18, rig_description = $19,
             updated_at = NOW()
         WHERE id = $20`,
        [
          norm.builder_name, norm.model_name, norm.variant_name, norm.year_start, norm.year_end,
          norm.hull_type, norm.rig_type, norm.displacement_kg, norm.ballast_kg, norm.loa_m,
          norm.lwl_m, norm.beam_m, norm.draft_m, norm.sail_area_main_m2, norm.sail_area_jib_m2,
          norm.sail_area_spinnaker_m2, norm.upwind_sa_m2, norm.downwind_sa_m2, norm.rig_description,
          boatId
        ]
      );

      // Update source
      await client.query(
        `UPDATE boat_sources
         SET raw_payload = $1, last_seen_at = NOW()
         WHERE boat_id = $2 AND source_url = $3`,
        [rawPayload, boatId, url]
      );
      
      logger.info(`[RigScraper] Updated existing boat ID: ${boatId} from URL: ${url}`);
    } else {
      // Look up by builder_name + model_name to deduplicate boats
      const dupRes = await client.query(
        `SELECT id FROM boats
         WHERE model_name = $1
           AND (builder_name = $2 OR (builder_name IS NULL AND $2 IS NULL))
         LIMIT 1`,
        [norm.model_name, norm.builder_name]
      );

      if (dupRes.rows.length > 0) {
        boatId = dupRes.rows[0].id;
        
        // Update boat
        await client.query(
          `UPDATE boats
           SET variant_name = COALESCE(variant_name, $1), year_start = COALESCE(year_start, $2),
               year_end = COALESCE(year_end, $3), hull_type = COALESCE(hull_type, $4),
               rig_type = COALESCE(rig_type, $5), updated_at = NOW()
           WHERE id = $6`,
          [norm.variant_name, norm.year_start, norm.year_end, norm.hull_type, norm.rig_type, boatId]
        );
      } else {
        // Insert new boat
        const insertRes = await client.query(
          `INSERT INTO boats (
             builder_name, model_name, variant_name, year_start, year_end,
             hull_type, rig_type, displacement_kg, ballast_kg, loa_m,
             lwl_m, beam_m, draft_m, sail_area_main_m2, sail_area_jib_m2,
             sail_area_spinnaker_m2, upwind_sa_m2, downwind_sa_m2, rig_description
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
           RETURNING id`,
          [
            norm.builder_name, norm.model_name, norm.variant_name, norm.year_start, norm.year_end,
            norm.hull_type, norm.rig_type, norm.displacement_kg, norm.ballast_kg, norm.loa_m,
            norm.lwl_m, norm.beam_m, norm.draft_m, norm.sail_area_main_m2, norm.sail_area_jib_m2,
            norm.sail_area_spinnaker_m2, norm.upwind_sa_m2, norm.downwind_sa_m2, norm.rig_description
          ]
        );
        boatId = insertRes.rows[0].id;
        logger.info(`[RigScraper] Created new boat ID: ${boatId} (${norm.builder_name || "Unknown"} ${norm.model_name})`);
      }

      // Record source link
      await client.query(
        `INSERT INTO boat_sources (boat_id, source_type, source_url, raw_payload)
         VALUES ($1, 'sailboatdata', $2, $3)`,
        [boatId, url, rawPayload]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error(`[RigScraper] Transaction failed for URL: ${url}`, err);
    throw err;
  } finally {
    client.release();
  }
}
