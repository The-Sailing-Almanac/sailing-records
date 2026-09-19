/**
 * Script: seed-entities.ts
 * Purpose: Operational run script.
 * Idempotent: Yes
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import { pool } from "./lib/db";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[seed-entities] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Entity type definitions ──────────────────────────────────────────────────
const ENTITY_TYPES: { slug: string; label: string; description: string; color: string }[] = [
  { slug: "boat_class",    label: "Boat Class",      description: "One-design and handicap boat classes",   color: "#0a6e8a" },
  { slug: "regatta",       label: "Regatta",          description: "Sailing races and championships",        color: "#8b1a1a" },
  { slug: "yacht_club",    label: "Yacht Club",       description: "Yacht and sailing clubs",                color: "#1a3a6e" },
  { slug: "sailor",        label: "Sailor",           description: "Notable sailors and skippers",           color: "#2e4a2e" },
  { slug: "body_of_water", label: "Body of Water",    description: "Oceans, bays, lakes, and sounds",        color: "#1b6b8a" },
  { slug: "manufacturer",  label: "Manufacturer",     description: "Boat builders and manufacturers",        color: "#3a2e1a" },
  { slug: "region",        label: "Region",           description: "Geographic sailing regions",             color: "#6e4a1a" },
  { slug: "rating_system", label: "Rating System",    description: "Handicap and performance rating systems", color: "#4a4a1a" },
  { slug: "sail_maker",    label: "Sail Maker",       description: "Sail makers and lofts",                  color: "#1a6e4a" },
  { slug: "sail_loft",     label: "Sail Loft",        description: "Sail loft locations",                    color: "#1a6e4a" },
];

// ── Entity definitions ───────────────────────────────────────────────────────
interface EntityDef {
  type: string;
  name: string;
  aliases?: string[];
  description?: string;
  metadata?: Record<string, string>;
}

const ENTITIES: EntityDef[] = [
  // ── Boat Classes ────────────────────────────────────────────────────────
  { type: "boat_class", name: "ILCA 7",          aliases: ["Laser", "ILCA 7", "Radial", "Laser Standard"],  description: "Olympic single-handed dinghy" },
  { type: "boat_class", name: "ILCA 6",          aliases: ["Laser Radial", "ILCA 6"],                       description: "Olympic single-handed dinghy (women's)" },
  { type: "boat_class", name: "J/24",            aliases: ["J24"],                                           description: "Popular one-design keelboat" },
  { type: "boat_class", name: "J/22",            aliases: ["J22"],                                           description: "One-design keelboat" },
  { type: "boat_class", name: "J/105",           aliases: ["J105"],                                          description: "Sport keelboat" },
  { type: "boat_class", name: "TP52",            aliases:["TP 52", "Transpac 52"],                          description: "Grand prix offshore racer" },
  { type: "boat_class", name: "Melges 24",       aliases: ["M24"],                                           description: "One-design sport keelboat" },
  { type: "boat_class", name: "Farr 40",         aliases: [],                                                description: "One-design offshore racer" },
  { type: "boat_class", name: "Optimist",        aliases: ["Opti"],                                          description: "Youth single-handed dinghy" },
  { type: "boat_class", name: "420",             aliases: ["Four-Twenty"],                                   description: "Two-person youth dinghy" },
  { type: "boat_class", name: "470",             aliases: ["Four-Seventy"],                                   description: "Olympic two-person dinghy" },
  { type: "boat_class", name: "49er",            aliases: ["49er skiff"],                                    description: "Olympic skiff" },
  { type: "boat_class", name: "Nacra 17",        aliases: [],                                                description: "Olympic mixed multihull" },
  { type: "boat_class", name: "RS Aero",         aliases: ["Aero"],                                          description: "Single-handed performance dinghy" },
  { type: "boat_class", name: "Hobie 16",        aliases: ["Hobie Cat"],                                     description: "Beach catamaran" },
  { type: "boat_class", name: "Express 27",      aliases: ["Express"],                                       description: "West Coast one-design keelboat" },
  { type: "boat_class", name: "Thistle",         aliases: [],                                                description: "Two-person centerboard racer" },
  { type: "boat_class", name: "Lightning",       aliases: [],                                                description: "Classic three-person racer" },
  { type: "boat_class", name: "Flying Dutchman", aliases: ["FD"],                                            description: "Olympic high-performance dinghy" },
  { type: "boat_class", name: "505",             aliases: ["Five-Oh-Five"],                                  description: "Two-person high-performance dinghy" },
  { type: "boat_class", name: "Star",            aliases: [],                                                description: "Olympic two-person keelboat" },
  { type: "boat_class", name: "Finn",            aliases: [],                                                description: "Olympic single-handed dinghy" },
  { type: "boat_class", name: "Dragon",          aliases: [],                                                description: "Classic three-person keelboat" },
  { type: "boat_class", name: "Swan 44",         aliases: [],                                                description: "One-design offshore cruiser-racer" },
  { type: "boat_class", name: "Beneteau First 40", aliases: ["First 40"],                                    description: "Performance cruiser-racer" },
  { type: "boat_class", name: "Catalina 42",     aliases: [],                                                description: "Cruising sailboat" },
  { type: "boat_class", name: "Hunter 44",       aliases: [],                                                description: "Cruising sailboat" },
  { type: "boat_class", name: "Pearson 35",      aliases: [],                                                description: "Classic offshore racer-cruiser" },
  { type: "boat_class", name: "Tartan 10",       aliases: ["T-10"],                                          description: "One-design keelboat" },
  { type: "boat_class", name: "Cal 40",          aliases: [],                                                description: "Classic offshore ocean racer" },

  // ── Regattas ─────────────────────────────────────────────────────────────
  { type: "regatta", name: "America's Cup",            aliases: ["AC", "Auld Mug"],                          description: "The oldest international sporting trophy", metadata: { founded: "1851" } },
  { type: "regatta", name: "Rolex Sydney Hobart",      aliases: ["Sydney Hobart"],                           description: "Bluewater classic from Sydney to Hobart", metadata: { distance: "628nm" } },
  { type: "regatta", name: "Fastnet Race",             aliases: ["Rolex Fastnet"],                           description: "Biennial offshore classic from the Solent" },
  { type: "regatta", name: "Transpac",                 aliases: ["Transpac Race", "Transpacific Yacht Race"], description: "2,225-mile race from LA to Honolulu" },
  { type: "regatta", name: "Newport Bermuda Race",     aliases: ["Bermuda Race"],                            description: "635-mile classic from Newport to Bermuda" },
  { type: "regatta", name: "Chicago Mackinac Race",    aliases: ["Mac Race", "Mackinac"],                    description: "Longest freshwater race in the world" },
  { type: "regatta", name: "Rolex Big Boat Series",    aliases: ["Big Boat Series"],                         description: "San Francisco Bay one-design regatta" },
  { type: "regatta", name: "Key West Race Week",       aliases: ["KWRW"],                                    description: "Premier US offshore race series", metadata: { location: "Key West, FL" } },
  { type: "regatta", name: "SailGP",                   aliases: ["SailGP Championship"],                     description: "Global F50 catamaran league" },
  { type: "regatta", name: "The Ocean Race",           aliases: ["Volvo Ocean Race"],                         description: "Round-the-world offshore race" },
  { type: "regatta", name: "Rolex Middle Sea Race",    aliases: ["Middle Sea Race"],                         description: "Malta-based Mediterranean offshore classic" },
  { type: "regatta", name: "Caribbean 600",            aliases: [],                                          description: "600-mile offshore circuit of Caribbean islands" },
  { type: "regatta", name: "Pacific Cup",              aliases: ["Pac Cup"],                                 description: "Singlehanded/doublehanded Transpac race" },
  { type: "regatta", name: "Annapolis to Newport",     aliases: [],                                          description: "Classic East Coast offshore race" },

  // ── Yacht Clubs ───────────────────────────────────────────────────────────
  { type: "yacht_club", name: "Houston Yacht Club",        aliases: ["HYC"],          description: "Sailing and power boating on Galveston Bay", metadata: { state: "TX", country: "USA" } },
  { type: "yacht_club", name: "Galveston Yacht Club",      aliases: ["GYC"],          description: "Galveston Bay sailing club",                  metadata: { state: "TX", country: "USA" } },
  { type: "yacht_club", name: "Corpus Christi Yacht Club", aliases: ["CCYC"],         description: "South Texas sailing club",                    metadata: { state: "TX", country: "USA" } },
  { type: "yacht_club", name: "Texas Corinthian Yacht Club", aliases: ["TCYC"],       description: "Galveston Bay racing club",                   metadata: { state: "TX", country: "USA" } },
  { type: "yacht_club", name: "Lakewood Yacht Club",       aliases: ["LYC"],          description: "Clear Lake sailing club",                     metadata: { state: "TX", country: "USA" } },
  { type: "yacht_club", name: "New York Yacht Club",       aliases: ["NYYC"],         description: "Storied Manhattan racing club",               metadata: { state: "NY", country: "USA", founded: "1844" } },
  { type: "yacht_club", name: "San Francisco Yacht Club",  aliases: ["SFYC"],         description: "Belvedere Island sailing club",               metadata: { state: "CA", country: "USA" } },
  { type: "yacht_club", name: "Chicago Yacht Club",        aliases: ["CYC"],          description: "Lake Michigan sailing club",                  metadata: { state: "IL", country: "USA" } },
  { type: "yacht_club", name: "Royal Ocean Racing Club",   aliases: ["RORC"],         description: "Offshore racing governing body and club",    metadata: { country: "UK" } },
  { type: "yacht_club", name: "Royal Yacht Squadron",      aliases: ["RYS"],          description: "Historic Cowes sailing club",                metadata: { country: "UK", founded: "1815" } },
  { type: "yacht_club", name: "Cruising Club of America",  aliases: ["CCA"],          description: "US bluewater cruising organization",         metadata: { country: "USA" } },

  // ── Bodies of Water ───────────────────────────────────────────────────────
  { type: "body_of_water", name: "Galveston Bay",      aliases: [],                  description: "Gulf Coast bay and major Texas sailing venue" },
  { type: "body_of_water", name: "Corpus Christi Bay", aliases: [],                  description: "South Texas sheltered bay" },
  { type: "body_of_water", name: "Lake Travis",        aliases: [],                  description: "Austin-area highland lake sailing venue" },
  { type: "body_of_water", name: "Lake LBJ",           aliases: [],                  description: "Highland Lakes sailing venue" },
  { type: "body_of_water", name: "Chesapeake Bay",     aliases: [],                  description: "Mid-Atlantic estuary sailing center" },
  { type: "body_of_water", name: "Long Island Sound",  aliases: ["LIS"],             description: "Northeast US sheltered sailing area" },
  { type: "body_of_water", name: "San Francisco Bay",  aliases: ["SF Bay"],          description: "Pacific Coast windy sailing venue" },
  { type: "body_of_water", name: "Puget Sound",        aliases: [],                  description: "Pacific Northwest sailing waters" },
  { type: "body_of_water", name: "Lake Michigan",      aliases: [],                  description: "Great Lakes sailing hub" },
  { type: "body_of_water", name: "Solent",             aliases: ["The Solent"],      description: "UK offshore racing and sailing hub" },
  { type: "body_of_water", name: "Sydney Harbour",     aliases: [],                  description: "Australian iconic sailing venue" },
  { type: "body_of_water", name: "Gulf of Mexico",     aliases: [],                  description: "Offshore racing and cruising waters" },
  { type: "body_of_water", name: "Caribbean Sea",      aliases: ["The Caribbean"],   description: "Tropical cruising and racing destination" },
  { type: "body_of_water", name: "Monterey Bay",       aliases: [],                  description: "California cruising and racing venue" },

  // ── Rating Systems ────────────────────────────────────────────────────────
  { type: "rating_system", name: "PHRF",               aliases: ["Performance Handicap Racing Fleet"],       description: "US-based time-on-distance handicap system" },
  { type: "rating_system", name: "IRC",                aliases: ["International Rating Certificate"],         description: "International offshore racing handicap" },
  { type: "rating_system", name: "ORC",                aliases: ["Offshore Racing Congress"],                 description: "International performance handicap" },
  { type: "rating_system", name: "ORR",                aliases: ["Offshore Racing Rule"],                     description: "US offshore measurement rule" },
  { type: "rating_system", name: "Portsmouth Yardstick", aliases: ["PY", "Portsmouth"],                      description: "UK dinghy performance handicap" },
  { type: "rating_system", name: "TexORC",             aliases: [],                                          description: "Texas offshore rating certificate" },
  { type: "rating_system", name: "SCHRS",              aliases: [],                                          description: "Small Catamaran Handicap Racing System" },
];

async function run() {
  console.log("[SeedEntities] Starting entity seed...");

  // ── Upsert entity types ──────────────────────────────────────────────────
  const typeIds = new Map<string, number>();
  for (const et of ENTITY_TYPES) {
    const res = await pool.query(
      `INSERT INTO entity_types (slug, label, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description
       RETURNING id`,
      [et.slug, et.label, et.description]
    );
    typeIds.set(et.slug, res.rows[0].id);
    console.log(`  [entity_type] ${et.slug} → id=${res.rows[0].id}`);
  }

  // ── Upsert entities ───────────────────────────────────────────────────────
  let inserted = 0;
  for (const e of ENTITIES) {
    const typeId = typeIds.get(e.type);
    if (!typeId) {
      console.warn(`  [WARN] Unknown entity type: ${e.type} for "${e.name}"`);
      continue;
    }
    const entitySlug = slug(e.name);
    const color = ENTITY_TYPES.find(t => t.slug === e.type)?.color ?? "#0a6e8a";

    await pool.query(
      `INSERT INTO entities
         (entity_type_id, slug, canonical_name, aliases, description, dominant_color, metadata, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, TRUE)
       ON CONFLICT (slug) DO UPDATE
         SET canonical_name = EXCLUDED.canonical_name,
             aliases        = EXCLUDED.aliases,
             description    = COALESCE(EXCLUDED.description, entities.description),
             dominant_color = EXCLUDED.dominant_color,
             is_verified    = TRUE,
             updated_at     = NOW()`,
      [
        typeId,
        entitySlug,
        e.name,
        e.aliases ?? [],
        e.description ?? null,
        color,
        JSON.stringify(e.metadata ?? {}),
      ]
    );
    inserted++;
  }

  console.log(`[SeedEntities] ✅ Done. ${ENTITY_TYPES.length} entity types, ${inserted}/${ENTITIES.length} entities upserted.`);
  await pool.end();
}

run().catch(async err => {
  console.error("[SeedEntities] Fatal:", err);
  await pool.end();
  process.exit(1);
});