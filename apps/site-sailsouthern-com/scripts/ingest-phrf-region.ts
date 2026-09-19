/**
 * scripts/ingest-phrf-region.ts
 *
 * Command-line runner to ingest PHRF ratings for a region from a CSV file.
 * Usage:
 *   npx tsx scripts/ingest-phrf-region.ts <region-slug> <csv-file-path> [region-name]
 */

import fs from "fs";
import path from "path";
import { pool, closePool } from "./lib/db";

const dryRun = process.argv.includes("--dry-run");

// Helper to parse CSV lines with simple quotes handling
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Clean string for fuzzy matching
function cleanString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Fuzzy match boat model names to boat records
function findMatchingBoat(
  csvBoatName: string,
  dbBoats: Array<{ id: number; builder_name: string; model_name: string }>
): number | null {
  const cleanCSV = cleanString(csvBoatName);
  if (!cleanCSV) return null;

  // 1. Exact clean match of builder + model or model alone
  for (const boat of dbBoats) {
    const cleanModel = cleanString(boat.model_name);
    const cleanFull = cleanString(boat.builder_name + boat.model_name);
    
    if (cleanCSV === cleanFull || cleanCSV === cleanModel) {
      return boat.id;
    }
  }

  // 2. Check if cleanCSV contains the clean model and builder
  for (const boat of dbBoats) {
    const cleanModel = cleanString(boat.model_name);
    const cleanBuilder = cleanString(boat.builder_name);
    
    // Skip empty matches
    if (!cleanModel) continue;

    const hasBuilder = cleanCSV.includes(cleanBuilder) || 
                       cleanBuilder.includes("boats") || 
                       cleanBuilder.includes("yachts") || 
                       cleanBuilder.includes("marine");

    if (cleanCSV.includes(cleanModel) && hasBuilder) {
      return boat.id;
    }
  }

  // 3. Substring match for models of length >= 4
  for (const boat of dbBoats) {
    const cleanModel = cleanString(boat.model_name);
    if (cleanModel.length >= 4 && (cleanCSV.includes(cleanModel) || cleanModel.includes(cleanCSV))) {
      return boat.id;
    }
  }

  return null;
}

async function main() {
  // Strip flags
  const args = process.argv.slice(2).filter(arg => !arg.startsWith("--"));
  
  if (args.length < 2) {
    console.error("Usage: npx tsx scripts/ingest-phrf-region.ts <region-slug> <csv-file-path> [region-name]");
    process.exit(1);
  }

  const regionSlug = args[0];
  const csvPath = args[1];
  const regionName = args[2] || regionSlug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  if (!fs.existsSync(csvPath)) {
    console.error(`Error: File not found at ${csvPath}`);
    process.exit(1);
  }

  console.log(`[PHRF Ingest] Ingesting region: ${regionName} (${regionSlug})`);
  console.log(`[PHRF Ingest] Reading ratings CSV: ${csvPath}`);

  // 1. Ensure PHRF Region exists in DB
  let regionId: number;
  if (dryRun) {
    console.log(`[PHRF Ingest] [Dry Run] Would create/find region: ${regionName} (${regionSlug})`);
    regionId = 999;
  } else {
    const regionRes = await pool.query(
      `INSERT INTO phrf_regions (slug, name) 
       VALUES ($1, $2) 
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [regionSlug, regionName]
    );
    regionId = regionRes.rows[0].id;
    console.log(`[PHRF Ingest] Region DB ID: ${regionId}`);
  }

  // 2. Fetch existing boats for mapping
  const boatsRes = await pool.query("SELECT id, builder_name, model_name FROM boats");
  const dbBoats = boatsRes.rows;
  console.log(`[PHRF Ingest] Loaded ${dbBoats.length} boats from registry for mapping.`);

  // 3. Read and parse CSV file
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  if (lines.length < 2) {
    console.error("Error: CSV file is empty or missing headers.");
    process.exit(1);
  }

  // Expect headers: boat_class, rating_base, rating_spin, rating_nonspin, notes
  const headers = parseCSVLine(lines[0]);
  console.log("[PHRF Ingest] Detected CSV headers:", headers);

  let successCount = 0;
  let unmatchedCount = 0;
  const unmatchedList: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const columns = parseCSVLine(lines[i]);
    if (columns.length < 3) continue; // Skip incomplete lines

    // Parse columns by header order or position
    const csvBoatName = columns[0];
    const baseVal = parseInt(columns[1], 10);
    const spinVal = parseInt(columns[2], 10);
    const nonspinVal = columns[3] ? parseInt(columns[3], 10) : null;
    const notes = columns[4] || "";

    if (!csvBoatName) continue;

    // Try to match boat
    const matchedBoatId = findMatchingBoat(csvBoatName, dbBoats);

    if (matchedBoatId) {
      successCount++;
      if (dryRun) {
        console.log(`[PHRF Ingest] [Dry Run] Match: "${csvBoatName}" -> Boat ID ${matchedBoatId} (Base: ${baseVal}, Spin: ${spinVal})`);
      } else {
        await pool.query(
          `INSERT INTO phrf_ratings (region_id, boat_id, rating_base, rating_spin, rating_nonspin, notes, source_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (region_id, boat_id) DO UPDATE SET
             rating_base = EXCLUDED.rating_base,
             rating_spin = EXCLUDED.rating_spin,
             rating_nonspin = EXCLUDED.rating_nonspin,
             notes = EXCLUDED.notes,
             last_seen_at = NOW()`,
          [
            regionId,
            matchedBoatId,
            isNaN(baseVal) ? null : baseVal,
            isNaN(spinVal) ? null : spinVal,
            nonspinVal === null || isNaN(nonspinVal) ? null : nonspinVal,
            notes || null,
            `file://${path.basename(csvPath)}`,
          ]
        );
      }
    } else {
      unmatchedCount++;
      unmatchedList.push(csvBoatName);
    }
  }

  console.log(`\n[PHRF Ingest] Ingestion Summary:`);
  console.log(`- Total Records Processed: ${lines.length - 1}`);
  console.log(`- Successfully Mapped: ${successCount}`);
  console.log(`- Unmatched Boat Classes: ${unmatchedCount}`);
  
  if (unmatchedList.length > 0) {
    console.log(`\n[PHRF Ingest] Unmatched class examples (top 15):`);
    unmatchedList.slice(0, 15).forEach(name => console.log(`  - "${name}"`));
  }

  await closePool();
}

main().catch(err => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
