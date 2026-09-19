/**
 * Script: recompute-boat-consensus.ts
 * Purpose: Recompute the rig spec consensus for all boats based on raw sources.
 * Idempotent: Yes
 * Dry-run: --dry-run flag prints calculated consensus without saving to DB.
 * Last run: 2026-05-28
 */
import dotenv from "dotenv";
dotenv.config();

import { Pool } from "pg";
import { mergeSources, BoatSource } from "@stax/rig-db";

const dryRun = process.argv.includes("--dry-run");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log(`[ConsensusRecompute] Starting spec consolidation. Dry Run: ${dryRun}`);

  // 1. Get all unique boat IDs that have sources
  const boatIdsRes = await pool.query<{ boat_id: number }>(
    `SELECT DISTINCT boat_id FROM boat_sources ORDER BY boat_id`
  );
  
  const boatIds = boatIdsRes.rows.map((r) => r.boat_id);
  console.log(`[ConsensusRecompute] Found ${boatIds.length} boats with raw sources to evaluate.`);

  let updatedCount = 0;

  for (const boatId of boatIds) {
    // 2. Fetch all raw sources for this boat
    const sourcesRes = await pool.query<BoatSource>(
      `SELECT id, boat_id, source_type, source_url, snapshot_url, snapshot_date, raw_payload
       FROM boat_sources
       WHERE boat_id = $1`,
      [boatId]
    );
    const sources = sourcesRes.rows;

    if (sources.length === 0) continue;

    // 2b. Fetch user votes for this boat
    const votesRes = await pool.query<{
      field_name: string;
      thumbs_up: number;
      flags: number;
    }>(
      `SELECT field_name,
              COUNT(*) FILTER (WHERE vote = 'up')::int as thumbs_up,
              COUNT(*) FILTER (WHERE vote = 'flag')::int as flags
       FROM boat_spec_votes
       WHERE boat_id = $1
       GROUP BY field_name`,
      [boatId]
    );
    const votesMap = new Map<string, { thumbs_up: number; flags: number }>();
    for (const row of votesRes.rows) {
      votesMap.set(row.field_name, { thumbs_up: row.thumbs_up, flags: row.flags });
    }

    // 3. Recompute consensus
    const consensusFields = mergeSources(sources);
    
    if (consensusFields.length === 0) {
      console.log(`[ConsensusRecompute] Boat ID ${boatId}: No fields resolved to consensus.`);
      continue;
    }

    if (dryRun) {
      console.log(`\n[ConsensusRecompute] [Dry Run] Boat ID ${boatId} (${sources.length} sources):`);
      for (const f of consensusFields) {
        const val = f.value_numeric !== undefined && f.value_numeric !== null ? f.value_numeric : f.value_text;
        const votes = votesMap.get(f.field_name) || { thumbs_up: 0, flags: 0 };
        let conf = f.confidence;
        if (votes.thumbs_up > 0) conf += votes.thumbs_up * 0.05;
        if (votes.flags > 0) conf -= votes.flags * 0.10;
        conf = Math.max(0, Math.min(1, Math.round(conf * 100) / 100));
        console.log(`  - ${f.field_name}: ${val} (confidence: ${conf}, sources: ${f.num_sources}, 👍: ${votes.thumbs_up}, 🚩: ${votes.flags})`);
      }
      updatedCount++;
      continue;
    }

    // 4. Save consensus fields to database
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Upsert into boat_spec_consensus
      for (const field of consensusFields) {
        const votes = votesMap.get(field.field_name) || { thumbs_up: 0, flags: 0 };
        let confidence = field.confidence;
        if (votes.thumbs_up > 0) {
          confidence += votes.thumbs_up * 0.05;
        }
        if (votes.flags > 0) {
          confidence -= votes.flags * 0.10;
        }
        confidence = Math.max(0.0, Math.min(1.0, Math.round(confidence * 100) / 100));

        await client.query(
          `INSERT INTO boat_spec_consensus (
             boat_id, field_name, value_numeric, value_text, confidence, num_sources, num_thumbs_up, num_flags, debug_info, last_recomputed_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           ON CONFLICT (boat_id, field_name) DO UPDATE SET
             value_numeric = EXCLUDED.value_numeric,
             value_text = EXCLUDED.value_text,
             confidence = EXCLUDED.confidence,
             num_sources = EXCLUDED.num_sources,
             num_thumbs_up = EXCLUDED.num_thumbs_up,
             num_flags = EXCLUDED.num_flags,
             debug_info = EXCLUDED.debug_info,
             last_recomputed_at = NOW()`,
          [
            boatId,
            field.field_name,
            field.value_numeric ?? null,
            field.value_text ?? null,
            confidence,
            field.num_sources,
            votes.thumbs_up,
            votes.flags,
            field.debug_info ?? null,
          ]
        );
      }

      // Map fields to boats table columns
      const updateFields: Record<string, any> = {
        displacement_kg: null,
        ballast_kg: null,
        loa_m: null,
        lwl_m: null,
        beam_m: null,
        draft_m: null,
        sail_area_main_m2: null,
        sail_area_jib_m2: null,
        sail_area_spinnaker_m2: null,
        upwind_sa_m2: null,
        downwind_sa_m2: null,
        rig_description: null,
        hull_type: null,
        rig_type: null,
      };

      for (const field of consensusFields) {
        if (field.field_name in updateFields) {
          updateFields[field.field_name] = field.value_numeric !== undefined && field.value_numeric !== null
            ? field.value_numeric
            : field.value_text;
        }
      }

      // Update main boats table row
      await client.query(
        `UPDATE boats SET
           displacement_kg = $1, ballast_kg = $2, loa_m = $3, lwl_m = $4, beam_m = $5,
           draft_m = $6, sail_area_main_m2 = $7, sail_area_jib_m2 = $8, sail_area_spinnaker_m2 = $9,
           upwind_sa_m2 = $10, downwind_sa_m2 = $11, rig_description = $12, hull_type = $13,
           rig_type = $14, updated_at = NOW()
         WHERE id = $15`,
        [
          updateFields.displacement_kg,
          updateFields.ballast_kg,
          updateFields.loa_m,
          updateFields.lwl_m,
          updateFields.beam_m,
          updateFields.draft_m,
          updateFields.sail_area_main_m2,
          updateFields.sail_area_jib_m2,
          updateFields.sail_area_spinnaker_m2,
          updateFields.upwind_sa_m2,
          updateFields.downwind_sa_m2,
          updateFields.rig_description,
          updateFields.hull_type,
          updateFields.rig_type,
          boatId,
        ]
      );

      await client.query("COMMIT");
      updatedCount++;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`[ConsensusRecompute] Transaction failed for boat ID ${boatId}:`, err);
    } finally {
      client.release();
    }
  }

  console.log(`[ConsensusRecompute] ✅ Finished. Consolidated ${updatedCount} boats.`);
  await pool.end();
}

main().catch((err) => {
  console.error("[ConsensusRecompute] Fatal error:", err);
  process.exit(1);
});
