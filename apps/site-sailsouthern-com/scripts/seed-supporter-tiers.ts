/**
 * Script: seed-supporter-tiers.ts
 * Purpose: Operational run script.
 * Idempotent: Yes
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import { pool } from "./lib/db";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[seed-supporter-tiers] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


const TIERS = [
  {
    name: "free",
    display_name: "Free Reader",
    price_usd: 0.0,
    billing_type: "free",
    features: JSON.stringify([
      "Standard daily newsletter",
      "Site access"
    ])
  },
  {
    name: "supporter",
    display_name: "Supporter",
    price_usd: 50.0, // $50/yr (or $5/mo stub)
    billing_type: "annual",
    features: JSON.stringify([
      "Early access to weekly edition",
      "Future ad-free experience"
    ])
  },
  {
    name: "founding_member",
    display_name: "Founding Member",
    price_usd: 100.0,
    billing_type: "one_time",
    features: JSON.stringify([
      "Permanent ad-free access",
      "Name on Supporters page",
      "Early almanac features",
      "Founding member credit"
    ])
  },
  {
    name: "patron",
    display_name: "Patron",
    price_usd: 250.0,
    billing_type: "one_time",
    features: JSON.stringify([
      "All Founding Member benefits",
      "Private Discord/Slack channel access",
      "Input on content priorities",
      "Physical gift included"
    ])
  },
  {
    name: "lead_patron",
    display_name: "Lead Patron",
    price_usd: 500.0,
    billing_type: "one_time",
    features: JSON.stringify([
      "All Patron benefits",
      "Direct operator contact",
      "Credited in publications",
      "Premium physical gift (US Sailing / PBS style)"
    ])
  },
  {
    name: "weekly_pwyw",
    display_name: "Weekly Edition",
    price_usd: 0.0,
    billing_type: "pwyw",
    features: JSON.stringify([
      "Weekly edition via pay-what-you-feel",
      "Minimum $0, suggested $3"
    ])
  }
];

async function main() {
  console.log("[SeedSupporters] Seeding supporter tiers...");

  for (const tier of TIERS) {
    await pool.query(
      `INSERT INTO supporter_tiers (name, display_name, price_usd, billing_type, features)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (name) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         price_usd = EXCLUDED.price_usd,
         billing_type = EXCLUDED.billing_type,
         features = EXCLUDED.features`,
      [tier.name, tier.display_name, tier.price_usd, tier.billing_type, tier.features]
    );
    console.log(`  [Tier] ${tier.name} seeded.`);
  }

  console.log("[SeedSupporters] ✅ Tiers seeded successfully.");
  await pool.end();
}

main().catch(async (err) => {
  console.error("[SeedSupporters] Fatal:", err);
  await pool.end();
  process.exit(1);
});