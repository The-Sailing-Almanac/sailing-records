import { describe, test, expect } from "vitest";
import {
  normalizeUnits,
  compareValuesWithTolerance,
  mergeSources,
  BoatSource
} from "../src/index";

describe("@stax/rig-db", () => {
  test("normalizeUnits correctly parses feet/m, lbs/kg, and sqft/sqm", () => {
    const raw = {
      model_name: "J 24",
      builder_name: "Tillotson Pearson",
      loa: "24.00 ft / 7.32 m",
      displacement: "3,100 lbs / 1,406 kg",
      sail_area_main: "150 sq ft / 13.93 sq m",
      sail_area_jib: "100 sq ft / 9.29 sq m",
      year_start: "1977"
    };

    const norm = normalizeUnits(raw);

    expect(norm.model_name).toBe("J 24");
    expect(norm.loa_m).toBe(7.32);
    expect(norm.displacement_kg).toBe(1406);
    expect(norm.sail_area_main_m2).toBe(13.93);
    expect(norm.sail_area_jib_m2).toBe(9.29);
    expect(norm.upwind_sa_m2).toBe(23.22); // Computed: 13.93 + 9.29
    expect(norm.year_start).toBe(1977);
  });

  test("normalizeUnits converts imperial values if metric is missing", () => {
    const raw = {
      model_name: "Custom 30",
      loa: "30 ft",
      displacement: "10000 lbs",
      sail_area_main: "300 sq ft"
    };

    const norm = normalizeUnits(raw);

    expect(norm.loa_m).toBeCloseTo(9.14, 1); // 30 * 0.3048 = 9.144
    expect(norm.displacement_kg).toBeCloseTo(4535.9, 1); // 10000 * 0.45359 = 4535.9
    expect(norm.sail_area_main_m2).toBeCloseTo(27.87, 1); // 300 * 0.0929 = 27.87
  });

  test("compareValuesWithTolerance evaluates correctly within variance", () => {
    expect(compareValuesWithTolerance(100, 101, 0.02)).toBe(true); // 1% diff
    expect(compareValuesWithTolerance(100, 99, 0.02)).toBe(true);  // 1% diff
    expect(compareValuesWithTolerance(100, 103, 0.02)).toBe(false); // 3% diff
  });

  test("mergeSources resolves conflicts and aggregates metadata fields", () => {
    const sources: BoatSource[] = [
      {
        boat_id: 42,
        source_type: "sailboatdata",
        source_url: "https://example.com/source1",
        raw_payload: {
          model_name: "Catalina 30",
          builder_name: "Catalina Yachts",
          loa: "29.92 ft / 9.12 m",
          displacement: "10200 lbs / 4627 kg",
          hull_type: "Fin Keel"
        }
      },
      {
        boat_id: 42,
        source_type: "yachtworld",
        source_url: "https://example.com/source2",
        raw_payload: {
          model_name: "Catalina 30",
          builder_name: "Catalina", // conflict
          loa: "30.00 ft", // conflict but within tolerance
          displacement: "10200 lbs",
          hull_type: "Fin" // conflict
        }
      }
    ];

    const consensus = mergeSources(sources);

    const builderCons = consensus.find((c) => c.field_name === "builder_name");
    const loaCons = consensus.find((c) => c.field_name === "loa_m");
    const dispCons = consensus.find((c) => c.field_name === "displacement_kg");
    const hullCons = consensus.find((c) => c.field_name === "hull_type");

    expect(loaCons).toBeDefined();
    // (9.12 + 9.14) / 2 = 9.13
    expect(loaCons!.value_numeric).toBeCloseTo(9.13, 2);
    expect(loaCons!.confidence).toBeGreaterThan(0.8); // 2 agreeing sources -> high confidence

    expect(dispCons!.value_numeric).toBeCloseTo(4627, 0);

    // Text fields
    expect(builderCons!.value_text).toBe("Catalina Yachts"); // "Catalina Yachts" or "Catalina" based on length/alpha since counts are equal
    expect(hullCons!.value_text).toBe("Fin Keel");
  });

  test("mergeSources handles YachtWorld low trust, agreement boost, and disagreement penalty with debug_info", () => {
    // 1. Yachtworld-only source gets lower trust
    const ywOnlySources: BoatSource[] = [
      {
        boat_id: 101,
        source_type: "yachtworld",
        source_url: "https://example.com/yw1",
        raw_payload: {
          model_name: "Beneteau 31.7",
          loa: "31.17 ft / 9.50 m"
        }
      }
    ];
    const ywOnlyConsensus = mergeSources(ywOnlySources);
    const ywLoa = ywOnlyConsensus.find(c => c.field_name === "loa_m");
    expect(ywLoa).toBeDefined();
    expect(ywLoa!.value_numeric).toBe(9.5);
    // Baseline confidence for 1 source is 0.7. Capped at 60% for YachtWorld -> 0.42
    expect(ywLoa!.confidence).toBeCloseTo(0.42, 2);
    expect(ywLoa!.debug_info).toEqual({ note: "yachtworld only source" });

    // 2. Disagreement: prefer sailboatdata, penalize confidence, set debug_info
    const disagreeSources: BoatSource[] = [
      {
        boat_id: 102,
        source_type: "sailboatdata",
        source_url: "https://example.com/sbd",
        raw_payload: {
          model_name: "Hanse 315",
          loa: "9.45 m"
        }
      },
      {
        boat_id: 102,
        source_type: "yachtworld",
        source_url: "https://example.com/yw",
        raw_payload: {
          model_name: "Hanse 315",
          loa: "10.00 m" // > 2% variance
        }
      }
    ];
    const disagreeConsensus = mergeSources(disagreeSources);
    const disagreeLoa = disagreeConsensus.find(c => c.field_name === "loa_m");
    expect(disagreeLoa).toBeDefined();
    expect(disagreeLoa!.value_numeric).toBe(9.45); // Prefer sailboatdata (9.45) over YachtWorld (10.0)
    // sbd confidence is 0.7 (1 source). Penalized by 0.2 -> 0.50
    expect(disagreeLoa!.confidence).toBe(0.50);
    expect(disagreeLoa!.debug_info).toEqual({
      agreement: false,
      sailboatdata: 9.45,
      yachtworld: 10
    });
  });
});
