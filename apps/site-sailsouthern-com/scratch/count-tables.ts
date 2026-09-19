import { pool, closePool } from "../scripts/lib/db";

async function main() {
  const tables = [
    "boats",
    "boat_sources",
    "boat_spec_consensus",
    "phrf_ratings",
    "orc_certificates",
    "irc_certificates"
  ];

  console.log("=== DB Row Counts ===");
  for (const table of tables) {
    try {
      const res = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`${table}: ${res.rows[0].count}`);
    } catch (err: any) {
      console.error(`Error querying ${table}:`, err.message);
    }
  }

  await closePool();
}

main().catch(console.error);
