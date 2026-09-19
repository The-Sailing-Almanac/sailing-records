export type HandicapSystem = "PHRF_TOD" | "PHRF_TOT" | "PORTSMOUTH";

export interface RatingEntry {
  boatId: string;
  boatName: string;
  classDesign: string;
  phrfTod?: number; // sec/mile
  phrfTot?: number; // TCF directly
  portsmouthHc?: number; // Yardstick rating (e.g. 78.4 or 784)
}

export interface RaceResult {
  boatId: string;
  elapsedTimeSeconds: number; // in seconds
  ratingUsed: number; // phrf rating or portsmouth rating used in this race
}

export interface CorrectedResult {
  boatId: string;
  elapsedTimeSeconds: number;
  correctedTimeSeconds: number;
  place?: number;
}

/**
 * Calculates corrected time using PHRF Time-On-Distance (ToD).
 * Corrected Time = Elapsed Time (s) - (Rating (s/mi) * Distance (mi))
 */
export function scorePhrfTod(elapsedTimeSeconds: number, ratingSecPerMile: number, distanceMiles: number): number {
  const corrected = elapsedTimeSeconds - ratingSecPerMile * distanceMiles;
  return Math.max(0, Math.round(corrected * 100) / 100);
}

/**
 * PHRF Time-on-Distance with specific parameters for 11D compatibility
 */
export function scorePHRFToD(elapsedSeconds: number, distanceNm: number, ratingSecPerMile: number): number {
  return scorePhrfTod(elapsedSeconds, ratingSecPerMile, distanceNm);
}

/**
 * Calculates corrected time using PHRF Time-On-Time (ToT).
 * Corrected Time = Elapsed Time (s) * TCF
 * TCF = A / (B + PHRF)
 */
export function calculatePhrfTcf(phrfRating: number, A = 650, B = 550): number {
  return A / (B + phrfRating);
}

export function scorePhrfTot(elapsedTimeSeconds: number, phrfRatingOrTcf: number, isTcf = false, A = 650, B = 550): number {
  const tcf = isTcf ? phrfRatingOrTcf : calculatePhrfTcf(phrfRatingOrTcf, A, B);
  const corrected = elapsedTimeSeconds * tcf;
  return Math.max(0, Math.round(corrected * 100) / 100);
}

/**
 * PHRF Time-on-Time with specific parameters for 11D compatibility
 */
export function scorePHRFToT(elapsedSeconds: number, ratingSecPerMile: number, A = 650, B = 550): number {
  return scorePhrfTot(elapsedSeconds, ratingSecPerMile, false, A, B);
}

/**
 * Calculates the difference in time allowance (seconds) between two ratings for a given distance.
 * Shows how many seconds boat A (slower rating, higher number) is allowed vs boat B (faster rating).
 * positive means B owes A time; negative means A owes B time.
 */
export function getTimeAllowanceDiff(ratingA: number, ratingB: number, distanceNm: number): number {
  const diff = (ratingA - ratingB) * distanceNm;
  return Math.round(diff * 100) / 100;
}

/**
 * Calculates the difference in corrected time under Time-on-Time for a given elapsed duration.
 * Shows how much faster/slower boat A corrected time is vs boat B for same elapsed time.
 */
export function getTimeAllowanceDiffToT(ratingA: number, ratingB: number, elapsedSeconds: number, A = 650, B = 550): number {
  const tcfA = calculatePhrfTcf(ratingA, A, B);
  const tcfB = calculatePhrfTcf(ratingB, A, B);
  const correctedA = elapsedSeconds * tcfA;
  const correctedB = elapsedSeconds * tcfB;
  return Math.round((correctedA - correctedB) * 100) / 100;
}

/**
 * Calculates corrected time using Portsmouth Yardstick.
 * Corrected Time = (Elapsed Time (s) * 100) / Portsmouth Rating (HC)
 * Note: HC can be entered as e.g. 78.4 or 784. If entered as 784, HC is scaled down.
 */
export function scorePortsmouth(elapsedTimeSeconds: number, portsmouthHc: number): number {
  // If HC is entered as an integer (e.g. 784 instead of 78.4), scale it.
  const hcVal = portsmouthHc > 150 ? portsmouthHc / 10 : portsmouthHc;
  if (hcVal <= 0) return elapsedTimeSeconds;
  
  // Standard Portsmouth formula: (Elapsed Time * 100) / HC (where HC is e.g. 78.4)
  const corrected = (elapsedTimeSeconds * 100) / hcVal;
  return Math.max(0, Math.round(corrected * 100) / 100);
}

/**
 * Utility function to correct and rank a batch of results.
 */
export function scoreRace(
  system: HandicapSystem,
  results: RaceResult[],
  options: { distanceMiles?: number; A?: number; B?: number } = {}
): CorrectedResult[] {
  const scored: CorrectedResult[] = results.map((r) => {
    let corrected = r.elapsedTimeSeconds;
    if (system === "PHRF_TOD") {
      corrected = scorePhrfTod(r.elapsedTimeSeconds, r.ratingUsed, options.distanceMiles ?? 0);
    } else if (system === "PHRF_TOT") {
      corrected = scorePhrfTot(r.elapsedTimeSeconds, r.ratingUsed, false, options.A, options.B);
    } else if (system === "PORTSMOUTH") {
      corrected = scorePortsmouth(r.elapsedTimeSeconds, r.ratingUsed);
    }

    return {
      boatId: r.boatId,
      elapsedTimeSeconds: r.elapsedTimeSeconds,
      correctedTimeSeconds: corrected,
    };
  });

  // Sort by corrected time ascending (fastest first)
  scored.sort((a, b) => a.correctedTimeSeconds - b.correctedTimeSeconds);

  // Assign places
  return scored.map((item, index) => ({
    ...item,
    place: index + 1,
  }));
}

export interface BoatSpecsEstimationInput {
  loa_m?: number;
  beam_m?: number;
  draft_m?: number;
  displacement_kg?: number;
  sail_area_sqm?: number;
}

export interface ORCEstimate {
  gphMin: number;
  gphMax: number;
  explanation: string;
}

export interface IRCEstimate {
  tccMin: number;
  tccMax: number;
  explanation: string;
}

/**
 * Estimates ORC GPH range from a PHRF rating and optional boat specifications.
 * This is an educational approximation, not an official certificate value.
 */
export function estimateORCFromPHRF(phrfRating: number, specs?: BoatSpecsEstimationInput): ORCEstimate {
  // Baseline GPH is roughly PHRF + 525
  const baseGph = phrfRating + 525;

  // Refine based on boat specs (e.g. displacement-to-length ratio DL)
  let displacementModifier = 0;
  if (specs?.displacement_kg && specs?.loa_m) {
    // DL ratio: Displacement (long tons) / (0.01 * LWL)^3.
    // We approximate LWL as 85% of LOA.
    const lwl = specs.loa_m * 0.85;
    const dispTons = specs.displacement_kg / 1016.05;
    const dlRatio = lwl > 0 ? (dispTons / Math.pow(0.01 * lwl, 3)) : 200;
    
    // Light displacement boats (low DL) tend to rate faster in ORC (lower GPH)
    if (dlRatio < 150) {
      displacementModifier -= 6;
    } else if (dlRatio > 250) {
      displacementModifier += 6;
    }
  }

  const finalGph = baseGph + displacementModifier;
  return {
    gphMin: Math.round((finalGph - 15) * 10) / 10,
    gphMax: Math.round((finalGph + 15) * 10) / 10,
    explanation: "Based on a statistical baseline of regional PHRF fleets correlated with ORC GPH ratings. Adjusted for displacement-to-length ratio characteristics where available."
  };
}

/**
 * Estimates IRC TCC range from a PHRF rating and optional boat specifications.
 * This is an educational approximation, not an official certificate value.
 */
export function estimateTCCFromPHRF(phrfRating: number, specs?: BoatSpecsEstimationInput): IRCEstimate {
  // Baseline TCF from PHRF under Time-on-Time: TCF = 650 / (550 + PHRF)
  const baseTcc = 650 / (550 + phrfRating);

  // Refine based on sail area to displacement ratio
  let saDispModifier = 0;
  if (specs?.sail_area_sqm && specs?.displacement_kg) {
    // SA/D ratio = SA_sqm / (Displacement_kg / 1025)^(2/3)
    const saDispRatio = specs.sail_area_sqm / Math.pow(specs.displacement_kg / 1025, 2/3);

    // Highly powered boats (SA/D > 22) rate higher (TCC increases)
    if (saDispRatio > 22) {
      saDispModifier += 0.012;
    } else if (saDispRatio < 15) {
      saDispModifier -= 0.012;
    }
  }

  const finalTcc = baseTcc + saDispModifier;
  return {
    tccMin: Math.round((finalTcc - 0.015) * 1000) / 1000,
    tccMax: Math.round((finalTcc + 0.015) * 1000) / 1000,
    explanation: "Derived from standard PHRF-to-Time-on-Time conversions. Adjusted for sail-area-to-displacement ratio characteristics where available."
  };
}

