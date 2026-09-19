/**
 * scripts/ingest-orc-certificates.ts
 *
 * Command-line runner to ingest ORC certificates from a JSON file.
 * Usage:
 *   npx tsx scripts/ingest-orc-certificates.ts <json-file-path>
 */

import fs from "fs";
import path from "path";
import { pool, closePool } from "./lib/db";

const dryRun = process.argv.includes("--dry-run");

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
  const args = process.argv.slice(2).filter(arg => !arg.startsWith("--"));
  
  if (args.length < 1) {
    console.error("Usage: npx tsx scripts/ingest-orc-certificates.ts <json-file-path>");
    process.exit(1);
  }

  const jsonPath = args[0];

  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: File not found at ${jsonPath}`);
    process.exit(1);
  }

  console.log(`[ORC Ingest] Reading certificates JSON: ${jsonPath}`);
  const rawData = fs.readFileSync(jsonPath, "utf-8");
  const certs = JSON.parse(rawData);

  if (!Array.isArray(certs)) {
    console.error("Error: JSON must be an array of certificates.");
    process.exit(1);
  }

  // Fetch boats
  const boatsRes = await pool.query("SELECT id, builder_name, model_name FROM boats");
  const dbBoats = boatsRes.rows;
  console.log(`[ORC Ingest] Loaded ${dbBoats.length} boats from registry for mapping.`);

  let successCount = 0;
  let unmatchedCount = 0;

  for (const cert of certs) {
    const boatModel = cert.boat_model;
    if (!boatModel) {
      console.warn(`[ORC Ingest] Skipping record with missing boat_model`);
      continue;
    }

    const boatId = findMatchingBoat(boatModel, dbBoats);
    if (!boatId) {
      console.warn(`[ORC Ingest] Could not map boat_model: "${boatModel}" to any registry boat.`);
      unmatchedCount++;
      continue;
    }

    successCount++;
    if (dryRun) {
      console.log(`[ORC Ingest] [Dry Run] Map: "${boatModel}" -> Boat ID ${boatId} (Cert ID: ${cert.external_id})`);
    } else {
      await pool.query(
        `INSERT INTO orc_certificates (
          external_id, boat_id, owner_name, club_name, gph, loa_m, lwl_m,
          beam_m, draft_m, displacement_kg, upwind_sa_m2, downwind_sa_m2, cert_year, source_url, raw_payload
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (external_id) DO UPDATE SET
           boat_id = EXCLUDED.boat_id,
           owner_name = EXCLUDED.owner_name,
           club_name = EXCLUDED.club_name,
           gph = EXCLUDED.gph,
           loa_m = EXCLUDED.loa_m,
           lwl_m = EXCLUDED.lwl_m,
           beam_m = EXCLUDED.beam_m,
           draft_m = EXCLUDED.draft_m,
           displacement_kg = EXCLUDED.displacement_kg,
           upwind_sa_m2 = EXCLUDED.upwind_sa_m2,
           downwind_sa_m2 = EXCLUDED.downwind_sa_m2,
           cert_year = EXCLUDED.cert_year,
           source_url = EXCLUDED.source_url,
           raw_payload = EXCLUDED.raw_payload`,
        [
          cert.external_id,
          boatId,
          cert.owner_name || null,
          cert.club_name || null,
          cert.gph,
          cert.loa_m || null,
          cert.lwl_m || null,
          cert.beam_m || null,
          cert.draft_m || null,
          cert.displacement_kg || null,
          cert.upwind_sa_m2 || null,
          cert.downwind_sa_m2 || null,
          cert.cert_year || null,
          cert.source_url || null,
          JSON.stringify(cert)
        ]
      );
    }
  }

  console.log(`\n[ORC Ingest] Summary:`);
  console.log(`- Total Processed: ${certs.length}`);
  console.log(`- Mapped successfully: ${successCount}`);
  console.log(`- Unmatched boats: ${unmatchedCount}`);

  await closePool();
}

main().catch(err => {
  console.error("ORC Ingest script failed:", err);
  process.exit(1);
});
