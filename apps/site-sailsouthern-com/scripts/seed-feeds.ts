#!/usr/bin/env node
/**
 * Script: seed-feeds.ts
 * Purpose: Reads initial-feeds.txt and seeds feed_endpoints.
 * Idempotent: Yes — skips on conflict.
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[seed-feeds] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


dotenv.config({ path: path.resolve(__dirname, "../.env") });

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx scripts/seed-feeds.ts <path-to-feeds.txt>");
  process.exit(1);
}

const dbPool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const raw = fs.readFileSync(path.resolve(filePath), "utf-8");
  const lines = raw.split("\n");

  let inserted = 0;
  let skipped = 0;

  for (const raw_line of lines) {
    const line = raw_line.trim();
    if (!line || line.startsWith("#")) continue;

    try {
      const result = await dbPool.query(
        `INSERT INTO feed_endpoints (url, is_active, crawl_frequency_minutes)
         VALUES ($1, true, 60)
         ON CONFLICT (url) DO NOTHING`,
        [line]
      );
      if ((result.rowCount ?? 0) > 0) {
        console.log(`  [+] Inserted: ${line}`);
        inserted++;
      } else {
        console.log(`  [=] Already exists, skipped: ${line}`);
        skipped++;
      }
    } catch (err: any) {
      console.error(`  [!] Error inserting ${line}: ${err.message}`);
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
  await dbPool.end();
}

main();
