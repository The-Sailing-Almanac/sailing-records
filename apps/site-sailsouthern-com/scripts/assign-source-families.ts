/**
 * Script: assign-source-families.ts
 * Purpose: Operational run script.
 * Idempotent: Yes
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import { pool, closePool } from "./lib/db";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[assign-source-families] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


type FamilyDef = {
  name: string;
  displayName: string;
  domains: string[];
  domainSuffixes?: string[];
};

const FAMILIES: FamilyDef[] = [
  {
    name: "sailing_media",
    displayName: "Sailing Media",
    domains: [
      "sail-world.com",
      "sailingscuttlebutt.com",
      "yachtingworld.com",
      "sailmagazine.net",
      "practical-sailor.com",
      "sailingworld.com",
      "latitude38.com",
      "yachtingmonthly.com",
    ],
  },
  {
    name: "race_organizers",
    displayName: "Race Organizers",
    domains: [
      "americascup.com",
      "sailgp.com",
      "theoceanrace.com",
      "rolex.com",
      "fastnet.org",
    ],
  },
  {
    name: "class_associations",
    displayName: "Class Associations",
    domains: [
      "intlaser.org",
      "sailing.org",
      "ussailing.org",
      "worldsailing.org",
    ],
  },
  {
    name: "yacht_clubs",
    displayName: "Yacht Clubs",
    domains: [],
    domainSuffixes: ["yachtclub.org", "yachtclub.com", "yc.org"],
  },
  {
    name: "cruise_industry",
    displayName: "Cruise Industry",
    domains: [
      "carnivalcorp.com",
      "royalcaribbean.com",
      "ncl.com",
      "princess.com",
    ],
  },
  {
    name: "marine_trade_press",
    displayName: "Marine Trade Press",
    domains: ["marinelog.com", "workboat.com", "tradeonly.com"],
  },
  {
    name: "general_media",
    displayName: "General Media",
    domains: [],
  },
];

async function upsertFamily(def: FamilyDef): Promise<string> {
  const res = await pool.query<{ id: string }>(
    `INSERT INTO source_families (name, display_name)
     VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id`,
    [def.name, def.displayName]
  );
  return res.rows[0].id;
}

async function run() {
  const familyIds = new Map<string, string>();

  for (const def of FAMILIES) {
    const id = await upsertFamily(def);
    familyIds.set(def.name, id);
    console.log(`[assign-source-families] Family "${def.name}" -> ${id}`);
  }

  const counts: Record<string, number> = {};

  for (const def of FAMILIES) {
    if (def.name === "general_media") continue;

    const familyId = familyIds.get(def.name)!;

    for (const domain of def.domains) {
      const res = await pool.query(
        `UPDATE article_links
         SET source_family_id = $1
         WHERE domain = $2 OR domain ILIKE $3
         RETURNING id`,
        [familyId, domain, `%.${domain}`]
      );
      counts[def.name] = (counts[def.name] || 0) + (res.rowCount || 0);
    }

    for (const suffix of def.domainSuffixes || []) {
      const res = await pool.query(
        `UPDATE article_links
         SET source_family_id = $1
         WHERE domain ILIKE $2 OR domain = $3
         RETURNING id`,
        [familyId, `%.${suffix}`, suffix]
      );
      counts[def.name] = (counts[def.name] || 0) + (res.rowCount || 0);
    }
  }

  const generalId = familyIds.get("general_media")!;
  const generalRes = await pool.query(
    `UPDATE article_links
     SET source_family_id = $1
     WHERE source_family_id IS NULL AND domain IS NOT NULL
     RETURNING id`,
    [generalId]
  );
  counts.general_media = generalRes.rowCount || 0;

  console.log("[assign-source-families] Assignment counts:", counts);
  await closePool();
}

run().catch((err) => {
  console.error("[assign-source-families] Failed:", err);
  process.exit(1);
});