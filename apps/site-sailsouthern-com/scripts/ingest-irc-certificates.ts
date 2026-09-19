/**
 * scripts/ingest-irc-certificates.ts
 *
 * Command-line runner to ingest IRC certificates from a JSON file.
 * Usage:
 *   npx tsx scripts/ingest-irc-certificates.ts <json-file-path>
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
    console.error("Usage: npx tsx scripts/ingest-irc-certificates.ts <json-file-path>");
    process.exit(1);
  }

  const jsonPath = args[0];

  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: File not found at ${jsonPath}`);
    process.exit(1);
  }

  console.log(`[IRC Ingest] Reading certificates JSON: ${jsonPath}`);
  const rawData = fs.readFileSync(jsonPath, "utf-8");
  const certs = JSON.parse(rawData);

  if (!Array.isArray(certs)) {
    console.error("Error: JSON must be an array of certificates.");
    process.exit(1);
  }

  // Fetch boats
  const boatsRes = await pool.query("SELECT id, builder_name, model_name FROM boats");
  const dbBoats = boatsRes.rows;
  console.log(`[IRC Ingest] Loaded ${dbBoats.length} boats from registry for mapping.`);

  let successCount = 0;
  let unmatchedCount = 0;

  for (const cert of certs) {
    const boatModel = cert.boat_model;
    if (!boatModel) {
      console.warn(`[IRC Ingest] Skipping record with missing boat_model`);
      continue;
    }

    const boatId = findMatchingBoat(boatModel, dbBoats);
    if (!boatId) {
      console.warn(`[IRC Ingest] Could not map boat_model: "${boatModel}" to any registry boat.`);
      unmatchedCount++;
      continue;
    }

    successCount++;
    if (dryRun) {
      console.log(`[IRC Ingest] [Dry Run] Map: "${boatModel}" -> Boat ID ${boatId} (TCC: ${cert.tcc})`);
    } else {
      // Check if existing record exists for this boat_id and cert_year
      const checkRes = await pool.query(
        "SELECT id FROM irc_certificates WHERE boat_id = $1 AND cert_year = $2",
        [boatId, cert.cert_year]
      );

      if (checkRes.rows[0]) {
        // Update
        await pool.query(
          `UPDATE irc_certificates SET
             tcc = $1,
             source_url = $2,
             raw_payload = $3
           WHERE id = $4`,
          [
            cert.tcc,
            cert.source_url || null,
            JSON.stringify(cert),
            checkRes.rows[0].id
          ]
        );
      } else {
        // Insert
        await pool.query(
          `INSERT INTO irc_certificates (boat_id, tcc, cert_year, source_url, raw_payload)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            boatId,
            cert.tcc,
            cert.cert_year,
            cert.source_url || null,
            JSON.stringify(cert)
          ]
        );
      }
    }
  }

  console.log(`\n[IRC Ingest] Summary:`);
  console.log(`- Total Processed: ${certs.length}`);
  console.log(`- Mapped successfully: ${successCount}`);
  console.log(`- Unmatched boats: ${unmatchedCount}`);

  await closePool();
}

main().catch(err => {
  console.error("IRC Ingest script failed:", err);
  process.exit(1);
});
