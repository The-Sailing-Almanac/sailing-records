/**
 * scripts/seed-phrf-boats.ts
 *
 * Seed script to populate reference boats and specifications consensus for testing.
 * Usage:
 *   npx tsx scripts/seed-phrf-boats.ts
 */

import { pool, closePool } from "./lib/db";

const REFERENCE_BOATS = [
  {
    builder_name: "J Boats",
    model_name: "J 24",
    variant_name: "Standard Rig",
    year_start: 1977,
    year_end: 2012,
    hull_type: "Fin Keel",
    rig_type: "Fractional Sloop",
    loa_m: 7.32,
    displacement_kg: 1406,
    engine_type: "Outboard",
    keel_type: "Fin",
    specs: {
      loa_m: { value: 7.32, confidence: 1.0 },
      beam_m: { value: 2.71, confidence: 0.95 },
      draft_m: { value: 1.22, confidence: 0.95 },
      displacement_kg: { value: 1406, confidence: 1.0 },
      sail_area_sqm: { value: 24.3, confidence: 0.9 },
    }
  },
  {
    builder_name: "Catalina Yachts",
    model_name: "Catalina 30",
    variant_name: "Standard Rig",
    year_start: 1974,
    year_end: 2008,
    hull_type: "Fin Keel",
    rig_type: "Masthead Sloop",
    loa_m: 9.12,
    displacement_kg: 4627,
    engine_type: "Universal Diesel",
    keel_type: "Fin",
    specs: {
      loa_m: { value: 9.12, confidence: 0.95 },
      beam_m: { value: 3.30, confidence: 0.95 },
      draft_m: { value: 1.60, confidence: 0.9 },
      displacement_kg: { value: 4627, confidence: 0.95 },
      sail_area_sqm: { value: 41.3, confidence: 0.85 },
    }
  },
  {
    builder_name: "Melges",
    model_name: "Melges 24",
    variant_name: "Standard",
    year_start: 1993,
    year_end: 2026,
    hull_type: "Lifting Bulb Keel",
    rig_type: "Fractional Sloop",
    loa_m: 7.32,
    displacement_kg: 809,
    engine_type: "Outboard",
    keel_type: "Fin with Bulb",
    specs: {
      loa_m: { value: 7.32, confidence: 1.0 },
      beam_m: { value: 2.49, confidence: 1.0 },
      draft_m: { value: 1.52, confidence: 1.0 },
      displacement_kg: { value: 809, confidence: 1.0 },
      sail_area_sqm: { value: 30.2, confidence: 0.95 },
    }
  },
  {
    builder_name: "J Boats",
    model_name: "J 70",
    variant_name: "Standard One-Design",
    year_start: 2012,
    year_end: 2026,
    hull_type: "Lifting Bulb Keel",
    rig_type: "Fractional Sloop",
    loa_m: 6.93,
    displacement_kg: 794,
    engine_type: "Outboard",
    keel_type: "Lifting Fin",
    specs: {
      loa_m: { value: 6.93, confidence: 1.0 },
      beam_m: { value: 2.25, confidence: 1.0 },
      draft_m: { value: 1.45, confidence: 1.0 },
      displacement_kg: { value: 794, confidence: 1.0 },
      sail_area_sqm: { value: 21.0, confidence: 0.95 },
    }
  },
  {
    builder_name: "Beneteau",
    model_name: "Oceanis 350",
    variant_name: "Standard Keel",
    year_start: 1986,
    year_end: 1993,
    hull_type: "Fin Keel",
    rig_type: "Masthead Sloop",
    loa_m: 10.31,
    displacement_kg: 4800,
    engine_type: "Yanmar Diesel",
    keel_type: "Fin",
    specs: {
      loa_m: { value: 10.31, confidence: 0.9 },
      beam_m: { value: 3.43, confidence: 0.9 },
      draft_m: { value: 1.56, confidence: 0.95 },
      displacement_kg: { value: 4800, confidence: 0.9 },
      sail_area_sqm: { value: 48.5, confidence: 0.8 },
    }
  }
];

async function seed() {
  console.log("[Seed Boats] Seeding reference boat models...");
  
  for (const item of REFERENCE_BOATS) {
    // Check if boat exists
    const checkRes = await pool.query(
      "SELECT id FROM boats WHERE builder_name = $1 AND model_name = $2",
      [item.builder_name, item.model_name]
    );

    let boatId: number;

    if (checkRes.rows[0]) {
      boatId = checkRes.rows[0].id;
      // Update fields
      await pool.query(
        `UPDATE boats SET
           variant_name = $1, year_start = $2, year_end = $3, hull_type = $4,
           rig_type = $5, loa_m = $6, displacement_kg = $7, engine_type = $8, keel_type = $9,
           updated_at = NOW()
         WHERE id = $10`,
        [
          item.variant_name,
          item.year_start,
          item.year_end,
          item.hull_type,
          item.rig_type,
          item.loa_m,
          item.displacement_kg,
          item.engine_type,
          item.keel_type,
          boatId
        ]
      );
    } else {
      // Insert
      const insertRes = await pool.query(
        `INSERT INTO boats (builder_name, model_name, variant_name, year_start, year_end, hull_type, rig_type, loa_m, displacement_kg, engine_type, keel_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          item.builder_name,
          item.model_name,
          item.variant_name,
          item.year_start,
          item.year_end,
          item.hull_type,
          item.rig_type,
          item.loa_m,
          item.displacement_kg,
          item.engine_type,
          item.keel_type
        ]
      );
      boatId = insertRes.rows[0].id;
    }

    console.log(`[Seed Boats] Seeded "${item.builder_name} ${item.model_name}" (ID: ${boatId})`);

    // Seed boat spec consensus values
    for (const [fieldName, spec] of Object.entries(item.specs)) {
      await pool.query(
        `INSERT INTO boat_spec_consensus (boat_id, field_name, value_numeric, confidence, num_sources, num_thumbs_up, num_flags)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (boat_id, field_name) DO UPDATE SET
           value_numeric = EXCLUDED.value_numeric,
           confidence = EXCLUDED.confidence`,
        [
          boatId,
          fieldName,
          spec.value,
          spec.confidence,
          1,
          0,
          0
        ]
      );
    }
  }

  console.log("[Seed Boats] Reference boats and consensus specs seeded successfully.");
  await closePool();
}

seed().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
