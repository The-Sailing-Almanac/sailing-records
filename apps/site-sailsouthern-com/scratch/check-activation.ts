/**
 * Activation Readiness Check
 * Checks DB schema, env var presence, and integration config status.
 * Prints only presence/absence — never prints secret values.
 */
import { pool } from "../scripts/lib/db";
import dotenv from "dotenv";
dotenv.config();

// ── 1. Required tables from migrations 025–027 ──────────────────────────────
const REQUIRED_TABLES = [
  "social_accounts",
  "social_posts",
  "social_post_deliveries",
  "social_post_media",
  "social_post_links",
  "social_post_metrics_snapshots",
  "social_post_archives",
  "social_post_revisions",
  "social_post_captures",
  "social_intake_sources",
  "social_publishing_runs",
];

// ── 2. Required env vars per integration ────────────────────────────────────
const ENV_MATRIX: Record<string, string[]> = {
  "Core DB":          ["DATABASE_URL"],
  "Core Redis":       ["REDIS_URL"],
  "Gemini AI":        ["GEMINI_API_KEY"],
  "Email (Resend)":   ["RESEND_API_KEY"],
  "Mastodon":         ["MASTODON_INSTANCE_URL", "MASTODON_ACCESS_TOKEN"],
  "Nostr":            ["NOSTR_PRIVATE_KEY", "NOSTR_RELAYS"],
  "Bluesky":          ["BLUESKY_IDENTIFIER", "BLUESKY_PASSWORD"],
  "Wayback SPN":      ["WAYBACK_ACCESS_KEY", "WAYBACK_SECRET_KEY"],
  "GA4 Events":       ["GA4_MEASUREMENT_ID", "GA4_API_SECRET"],
  "GA4 Data API":     ["GA4_PROPERTY_ID", "GA4_CLIENT_EMAIL", "GA4_PRIVATE_KEY"],
  "Scheduler":        ["PUBLISH_CRON_PATTERN", "PUBLISH_TIMEZONE"],
  "Lightning/V4V":    ["LIGHTNING_ADDRESS", "BOLT12_OFFER"],
  "Admin API":        ["ADMIN_API_KEY"],
  "Meilisearch":      ["MEILI_HTTP_ADDR", "MEILI_MASTER_KEY"],
};

function checkStatus(keys: string[]): "READY" | "PARTIAL" | "MISSING" {
  const present = keys.filter(k => !!process.env[k]);
  if (present.length === keys.length) return "READY";
  if (present.length > 0) return "PARTIAL";
  return "MISSING";
}

async function main() {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  ACTIVATION READINESS CHECK");
  console.log("══════════════════════════════════════════════════════════════\n");

  // ── DB Schema check ───────────────────────────────────────────────────────
  console.log("── DATABASE SCHEMA (migrations 025–027) ──────────────────────");
  try {
    const res = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [REQUIRED_TABLES]
    );
    const found = new Set(res.rows.map((r: any) => r.table_name));
    const missing: string[] = [];
    for (const t of REQUIRED_TABLES) {
      const status = found.has(t) ? "✅ EXISTS" : "❌ MISSING";
      if (!found.has(t)) missing.push(t);
      console.log(`  ${status.padEnd(12)} ${t}`);
    }
    if (missing.length === 0) {
      console.log("\n  → All required tables present. Migrations 025–027: APPLIED ✅\n");
    } else {
      console.log(`\n  → MISSING TABLES (${missing.length}): ${missing.join(", ")}`);
      console.log("  → Run apply-migration.ts for missing migrations ❌\n");
    }
  } catch (err: any) {
    console.log(`  ❌ DB CONNECTION FAILED: ${err.message}\n`);
  }
  await pool.end();

  // ── Env var / integration matrix ─────────────────────────────────────────
  console.log("── INTEGRATION SECRET MATRIX ─────────────────────────────────");
  const colW = 22;
  for (const [integration, keys] of Object.entries(ENV_MATRIX)) {
    const status = checkStatus(keys);
    const icon = status === "READY" ? "✅" : status === "PARTIAL" ? "⚠️ " : "❌";
    const missing = keys.filter(k => !process.env[k]);
    const missingNote = missing.length > 0 ? `  (missing: ${missing.join(", ")})` : "";
    console.log(`  ${icon} ${integration.padEnd(colW)} ${status}${missingNote}`);
  }

  console.log("\n══════════════════════════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("Check failed:", err);
  process.exit(1);
});
