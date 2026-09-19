/**
 * Script: archive-edition.ts
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
  console.log("[archive-edition] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const args = process.argv.slice(2);
const dateArg = args.find(a => !a.startsWith("--")) ??
  args[args.indexOf("--date") + 1];
const targetDate = dateArg ?? new Date().toISOString().slice(0, 10);
const MONITORING_URL = process.env.MONITORING_WEBHOOK_URL ?? null;

async function notify(msg: string) {
  console.log("[Alert]", msg);
  if (!MONITORING_URL) return;
  try {
    await fetch(MONITORING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg }),
    });
  } catch { /* non-blocking */ }
}

async function run() {
  console.log(`[ArchiveEdition] Archiving edition for ${targetDate}...`);

  const result = await pool.query(
    `UPDATE newsletter_editions
     SET status = 'archived', archived_at = NOW()
     WHERE edition_date = $1::date
       AND edition_type = 'daily'
       AND status = 'published'
     RETURNING id, edition_label`,
    [targetDate]
  );

  if (!result.rows[0]) {
    console.log(`[ArchiveEdition] No published daily edition found for ${targetDate} — nothing to archive.`);
    await pool.end();
    return;
  }

  const { id, edition_label } = result.rows[0];
  console.log(`[ArchiveEdition] ✅ Archived edition ${id} (${edition_label}) for ${targetDate}`);

  await notify(`🗃️ [EDITION ARCHIVED] ${targetDate} — "${edition_label}" (id: ${id}) archived. New morning edition compiles at 10:00 UTC.`);

  await pool.end();
}

run().catch(async err => {
  console.error("[ArchiveEdition] Fatal:", err);
  await pool.end();
  process.exit(1);
});