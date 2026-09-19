export interface BoatRaw {
  builder_name?: string | null;
  model_name: string;
  variant_name?: string | null;
  year_start?: number | null;
  year_end?: number | null;
  hull_type?: string | null;
  rig_type?: string | null;
  displacement_kg?: number | null;
  ballast_kg?: number | null;
  loa_m?: number | null;
  lwl_m?: number | null;
  beam_m?: number | null;
  draft_m?: number | null;
  sail_area_main_m2?: number | null;
  sail_area_jib_m2?: number | null;
  sail_area_spinnaker_m2?: number | null;
  upwind_sa_m2?: number | null;
  downwind_sa_m2?: number | null;
  rig_description?: string | null;
  [key: string]: any;
}

export interface BoatSource {
  id?: number;
  boat_id: number;
  source_type: string;
  source_url: string;
  snapshot_url?: string | null;
  snapshot_date?: string | null;
  raw_payload: Record<string, any>;
  first_seen_at?: string;
  last_seen_at?: string;
}

export interface ConsensusField {
  boat_id: number;
  field_name: string;
  value_numeric?: number | null;
  value_text?: string | null;
  confidence: number;
  num_sources: number;
  debug_info?: Record<string, any> | null;
}

/** Parses a dual-unit string (e.g. "24.00 ft / 7.32 m") and extracts the metric float. */
export function parseDimension(val: any): number | null {
  if (typeof val === "number") return val;
  if (!val || typeof val !== "string") return null;

  const clean = val.replace(/,/g, "");

  // Match metric first (e.g., "7.32 m" or "7.32m")
  const mMatch = clean.match(/([\d.]+)\s*(?:m|meter|meters)\b/i);
  if (mMatch) {
    return parseFloat(mMatch[1]);
  }

  // Fallback to feet conversion
  const ftMatch = clean.match(/([\d.]+)\s*(?:ft|feet|')/i);
  if (ftMatch) {
    return parseFloat(ftMatch[1]) * 0.3048;
  }

  // Direct number fallback
  const numMatch = clean.match(/^[\d.]+$/);
  if (numMatch) {
    return parseFloat(clean);
  }

  return null;
}

/** Parses weight strings (e.g. "3,100 lbs / 1,406 kg") and extracts kg. */
export function parseWeight(val: any): number | null {
  if (typeof val === "number") return val;
  if (!val || typeof val !== "string") return null;

  const clean = val.replace(/,/g, "");

  // Match kg first
  const kgMatch = clean.match(/([\d.]+)\s*(?:kg|kgs|kilogram|kilograms)\b/i);
  if (kgMatch) {
    return parseFloat(kgMatch[1]);
  }

  // Fallback to lbs
  const lbMatch = clean.match(/([\d.]+)\s*(?:lb|lbs|lbs\.|pound|pounds)\b/i);
  if (lbMatch) {
    return parseFloat(lbMatch[1]) * 0.45359237;
  }

  // Direct number fallback
  const numMatch = clean.match(/^[\d.]+$/);
  if (numMatch) {
    return parseFloat(clean);
  }

  return null;
}

/** Parses area strings (e.g. "240 sq ft / 22.3 sq m") and extracts sq m. */
export function parseArea(val: any): number | null {
  if (typeof val === "number") return val;
  if (!val || typeof val !== "string") return null;

  const clean = val.replace(/,/g, "");

  // Match sq m first
  const m2Match = clean.match(/([\d.]+)\s*(?:sq\s*m|m²|m2|sq\.m\.)/i);
  if (m2Match) {
    return parseFloat(m2Match[1]);
  }

  // Fallback to sq ft
  const ft2Match = clean.match(/([\d.]+)\s*(?:sq\s*ft|ft²|ft2|sq\.ft\.)/i);
  if (ft2Match) {
    return parseFloat(ft2Match[1]) * 0.09290304;
  }

  // Direct number fallback
  const numMatch = clean.match(/^[\d.]+$/);
  if (numMatch) {
    return parseFloat(clean);
  }

  return null;
}

/** Normalizes all fields of a raw scraped payload into standard metric units. */
export function normalizeUnits(rawPayload: Record<string, any>): BoatRaw {
  const norm: BoatRaw = {
    model_name: rawPayload.model_name || "Unknown",
    builder_name: rawPayload.builder_name || null,
    variant_name: rawPayload.variant_name || null,
    year_start: rawPayload.year_start ? parseInt(rawPayload.year_start, 10) : null,
    year_end: rawPayload.year_end ? parseInt(rawPayload.year_end, 10) : null,
    hull_type: rawPayload.hull_type || null,
    rig_type: rawPayload.rig_type || null,
    rig_description: rawPayload.rig_description || null,
  };

  const dimFields = ["loa", "lwl", "beam", "draft", "loa_m", "lwl_m", "beam_m", "draft_m"];
  const weightFields = ["displacement", "ballast", "displacement_kg", "ballast_kg"];
  const areaFields = [
    "sail_area_main", "sail_area_jib", "sail_area_spinnaker",
    "sail_area_main_m2", "sail_area_jib_m2", "sail_area_spinnaker_m2",
    "upwind_sa_m2", "downwind_sa_m2"
  ];

  // Map dimensions
  norm.loa_m = parseDimension(rawPayload.loa_m ?? rawPayload.loa);
  norm.lwl_m = parseDimension(rawPayload.lwl_m ?? rawPayload.lwl);
  norm.beam_m = parseDimension(rawPayload.beam_m ?? rawPayload.beam);
  norm.draft_m = parseDimension(rawPayload.draft_m ?? rawPayload.draft);

  // Map weights
  norm.displacement_kg = parseWeight(rawPayload.displacement_kg ?? rawPayload.displacement);
  norm.ballast_kg = parseWeight(rawPayload.ballast_kg ?? rawPayload.ballast);

  // Map sail areas
  norm.sail_area_main_m2 = parseArea(rawPayload.sail_area_main_m2 ?? rawPayload.sail_area_main);
  norm.sail_area_jib_m2 = parseArea(rawPayload.sail_area_jib_m2 ?? rawPayload.sail_area_jib);
  norm.sail_area_spinnaker_m2 = parseArea(rawPayload.sail_area_spinnaker_m2 ?? rawPayload.sail_area_spinnaker);

  // Compute upwind / downwind if not provided
  norm.upwind_sa_m2 = parseArea(rawPayload.upwind_sa_m2) || 
    ((norm.sail_area_main_m2 || 0) + (norm.sail_area_jib_m2 || 0) || null);
  
  norm.downwind_sa_m2 = parseArea(rawPayload.downwind_sa_m2) ||
    ((norm.sail_area_main_m2 || 0) + (norm.sail_area_spinnaker_m2 || 0) || null);

  // Round metrics to 2 decimal places for clean storage
  const roundFields: Array<keyof BoatRaw> = [
    "loa_m", "lwl_m", "beam_m", "draft_m",
    "displacement_kg", "ballast_kg",
    "sail_area_main_m2", "sail_area_jib_m2", "sail_area_spinnaker_m2",
    "upwind_sa_m2", "downwind_sa_m2"
  ];
  for (const f of roundFields) {
    if (typeof norm[f] === "number") {
      norm[f] = Math.round((norm[f] as number) * 100) / 100;
    }
  }

  return norm;
}

/** Compares two numeric values within a relative tolerance (e.g. 2%). */
export function compareValuesWithTolerance(a: number, b: number, tolerance = 0.02): boolean {
  if (a === b) return true;
  if (a === 0 || b === 0) return false;
  return Math.abs(a - b) / Math.max(a, b) <= tolerance;
}

/** Group and recompute a consensus field from multiple raw sources. */
/** Helper to run the original statistical clustering/agreement consensus on a list of values. */
function getSingleSourceConsensus(
  values: any[],
  compareTol = 0.02
): { val: any; confidence: number; agreement: number } | null {
  if (values.length === 0) return null;
  const firstVal = values[0];

  if (typeof firstVal === "string") {
    const counts: Record<string, number> = {};
    for (const val of values as string[]) {
      const clean = val.trim();
      if (clean) counts[clean] = (counts[clean] || 0) + 1;
    }

    let bestVal: string | null = null;
    let maxCount = 0;
    for (const k of Object.keys(counts)) {
      if (counts[k] > maxCount) {
        bestVal = k;
        maxCount = counts[k];
      }
    }

    if (bestVal === null) return null;

    const agreement = maxCount / values.length;
    const confidence = values.length >= 3 ? agreement : agreement * 0.8;
    return { val: bestVal, confidence, agreement };
  } else if (typeof firstVal === "number") {
    const numVals = values as number[];
    const clusters: number[][] = [];
    for (const val of numVals) {
      let placed = false;
      for (const cluster of clusters) {
        if (compareValuesWithTolerance(cluster[0], val, compareTol)) {
          cluster.push(val);
          placed = true;
          break;
        }
      }
      if (!placed) {
        clusters.push([val]);
      }
    }

    clusters.sort((a, b) => b.length - a.length);
    const mainCluster = clusters[0];
    const avg = mainCluster.reduce((sum, v) => sum + v, 0) / mainCluster.length;

    let baseConf = 0.7;
    if (values.length === 2) baseConf = 0.9;
    if (values.length >= 3) baseConf = 1.0;

    const agreement = mainCluster.length / values.length;
    const confidence = baseConf * agreement;

    return {
      val: Math.round(avg * 100) / 100,
      confidence,
      agreement
    };
  }

  return null;
}

/** Group and recompute a consensus field from multiple raw sources. */
export function mergeSources(sources: BoatSource[]): ConsensusField[] {
  if (sources.length === 0) return [];
  const boatId = sources[0].boat_id;
  const normBoats = sources.map((s) => ({
    ...normalizeUnits(s.raw_payload),
    _source_type: s.source_type,
  } as any));

  const allFields = new Set<string>();
  for (const nb of normBoats) {
    for (const k of Object.keys(nb)) {
      if (
        k !== "model_name" &&
        k !== "_source_type" &&
        nb[k] !== undefined &&
        nb[k] !== null
      ) {
        allFields.add(k);
      }
    }
  }

  const consensusList: ConsensusField[] = [];

  for (const field of allFields) {
    const s_vals: any[] = [];
    const y_vals: any[] = [];

    for (const nb of normBoats) {
      const v = nb[field];
      if (v !== undefined && v !== null) {
        if (nb._source_type === "yachtworld") {
          y_vals.push(v);
        } else {
          s_vals.push(v);
        }
      }
    }

    const s_res = getSingleSourceConsensus(s_vals);
    const y_res = getSingleSourceConsensus(y_vals);

    if (!s_res && !y_res) continue;

    let finalValue: any = null;
    let finalConfidence = 0;
    let debugInfo: Record<string, any> | null = null;
    const totalSourcesCount = s_vals.length + y_vals.length;

    if (s_res && y_res) {
      const s_val = s_res.val;
      const y_val = y_res.val;

      let agree = false;
      if (typeof s_val === "number" && typeof y_val === "number") {
        agree = compareValuesWithTolerance(s_val, y_val, 0.02);
      } else {
        agree = String(s_val).trim().toLowerCase() === String(y_val).trim().toLowerCase();
      }

      if (agree) {
        if (typeof s_val === "number" && typeof y_val === "number") {
          finalValue = Math.round(((s_val + y_val) / 2) * 100) / 100;
        } else {
          finalValue = s_val;
        }
        // Agreement boosts confidence
        finalConfidence = Math.min(1.0, Math.max(s_res.confidence, y_res.confidence) + 0.20);
      } else {
        // Disagreement: prefer sailboatdata
        finalValue = s_val;
        // Deduct confidence
        finalConfidence = Math.max(0.0, s_res.confidence - 0.20);
        debugInfo = {
          agreement: false,
          sailboatdata: s_val,
          yachtworld: y_val,
        };
      }
    } else if (s_res) {
      finalValue = s_res.val;
      finalConfidence = s_res.confidence;
    } else if (y_res) {
      // Yachtworld is low trust when alone
      finalValue = y_res.val;
      finalConfidence = y_res.confidence * 0.6; // low-trust multiplier
      debugInfo = {
        note: "yachtworld only source",
      };
    }

    if (finalValue !== null && finalValue !== undefined) {
      const isNum = typeof finalValue === "number";
      consensusList.push({
        boat_id: boatId,
        field_name: field,
        value_numeric: isNum ? finalValue : null,
        value_text: isNum ? null : finalValue,
        confidence: Math.round(finalConfidence * 100) / 100,
        num_sources: totalSourcesCount,
        debug_info: debugInfo,
      });
    }
  }

  return consensusList;
}
