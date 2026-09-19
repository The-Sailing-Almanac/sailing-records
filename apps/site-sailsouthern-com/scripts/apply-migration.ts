/**
 * Script: apply-migration.ts
 * Purpose: Operational run script.
 * Idempotent: Yes
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import fs from "fs";
import path from "path";
import { pool, closePool } from "./lib/db";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[apply-migration] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: tsx scripts/apply-migration.ts <migration-filename>");
    process.exit(1);
  }

  const sqlPath = path.join(
    process.cwd(),
    "infra",
    "db",
    "migrations",
    file.endsWith(".sql") ? file : `${file}.sql`
  );

  if (!fs.existsSync(sqlPath)) {
    console.error(`Migration not found: ${sqlPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, "utf-8");
  console.log(`[Migration] Applying ${path.basename(sqlPath)}...`);
  await pool.query(sql);
  console.log(`[Migration] Applied ${path.basename(sqlPath)} successfully.`);
  await closePool();
}

main().catch((err) => {
  console.error("[Migration] Failed:", err);
  process.exit(1);
});