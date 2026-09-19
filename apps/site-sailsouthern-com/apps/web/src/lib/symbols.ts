/**
 * apps/web/src/lib/symbols.ts
 *
 * Sprint 9A — Task A6: Symbol Library
 *
 * 32 named SVG symbol functions. Each accepts (color: string, size: number) and
 * returns a clean inline SVG string using only geometric SVG primitives.
 * Recognizable at 24px, clean at 200px.
 *
 * Also exports:
 *   SYMBOL_TAG_MAP   — maps tag/node slugs to symbol names
 *   getSymbolForTag  — looks up by slug, falls back to waveField
 *   getSymbolForEntityType — maps entity types to symbols
 */

export type SymbolName =
  | "burgee"
  | "olympicSail"
  | "oneDesign"
  | "grandPrixSpinnaker"
  | "compassRose"
  | "ropeCoil"
  | "anchor"
  | "waveField"
  | "helm"
  | "keelSection"
  | "foilWing"
  | "catamaranPlan"
  | "dinghySilhouette"
  | "starburst"
  | "cruisingSpinnaker"
  | "sailPanel"
  | "chandleryWrench"
  | "lifeRing"
  | "startingGun"
  | "regattaTrophy"
  | "collegePennant"
  | "sunsetHorizon"
  | "chartContour"
  | "windArrow"
  | "recordStopwatch"
  | "pennantString"
  | "cleatSideView"
  | "sextantArc"
  | "mapPinWake"
  | "booksAlmanac"
  | "microphone"
  | "superyachtProfile";

function svg(size: number, color: string, content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
}

function svgFill(size: number, color: string, content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="none">${content}</svg>`;
}

// ─── Individual Symbol Renderers ─────────────────────────────────────────────

/** burgee — triangular pennant with swallowtail notch at fly end */
function burgee(color: string, size: number): string {
  return svg(size, color,
    `<polygon points="2,4 22,12 2,20 5,12" fill="${color}" stroke="none"/>` +
    `<path d="M2 4 L22 12 L2 20 L5 12 Z" fill="${color}"/>`
  );
}

/** olympicSail — three overlapping circles forming a triangular sail silhouette */
function olympicSail(color: string, size: number): string {
  return svg(size, color,
    `<circle cx="12" cy="6" r="4"/>` +
    `<circle cx="7" cy="16" r="4"/>` +
    `<circle cx="17" cy="16" r="4"/>`
  );
}

/** oneDesign — two identical parallel hull profiles side-by-side */
function oneDesign(color: string, size: number): string {
  return svg(size, color,
    `<path d="M2 10 Q6 8 10 10 L8 14 Q6 15 4 14 Z"/>` +
    `<path d="M14 10 Q18 8 22 10 L20 14 Q18 15 16 14 Z"/>` +
    `<line x1="10" y1="9" x2="10" y2="5"/>` +
    `<line x1="22" y1="9" x2="22" y2="5"/>` +
    `<path d="M10 5 L10 9 L14 7 Z" fill="${color}"/>` +
    `<path d="M22 5 L22 9 L26 7 Z" fill="${color}"/>`
  );
}

/** grandPrixSpinnaker — asymmetric spinnaker balloon, raked mast, full hoist */
function grandPrixSpinnaker(color: string, size: number): string {
  return svg(size, color,
    `<path d="M12 2 L12 22"/>` +
    `<path d="M12 4 Q2 10 4 18 Q8 22 12 20 Q16 18 20 12 Q22 6 12 4 Z" fill="${color}" fill-opacity="0.18"/>` +
    `<path d="M12 4 Q2 10 4 18 Q8 22 12 20"/>` +
    `<path d="M12 4 Q22 6 20 12 Q18 18 12 20"/>`
  );
}

/** compassRose — 8-point minimal compass, cardinal points only */
function compassRose(color: string, size: number): string {
  return svg(size, color,
    `<polygon points="12,2 14,10 12,12 10,10" fill="${color}"/>` +
    `<polygon points="22,12 14,14 12,12 14,10" fill="${color}" opacity="0.6"/>` +
    `<polygon points="12,22 10,14 12,12 14,14" fill="${color}" opacity="0.8"/>` +
    `<polygon points="2,12 10,10 12,12 10,14" fill="${color}" opacity="0.6"/>` +
    `<polygon points="19.8,4.2 14.5,10.5 12,12 13.5,9.5" fill="${color}" opacity="0.4"/>` +
    `<polygon points="19.8,19.8 13.5,14.5 12,12 14.5,13.5" fill="${color}" opacity="0.4"/>` +
    `<polygon points="4.2,19.8 10.5,13.5 12,12 10.5,14.5" fill="${color}" opacity="0.4"/>` +
    `<polygon points="4.2,4.2 9.5,13.5 12,12 10.5,9.5" fill="${color}" opacity="0.4"/>`
  );
}

/** ropeCoil — top-view flemish flake circular coil */
function ropeCoil(color: string, size: number): string {
  return svg(size, color,
    `<circle cx="12" cy="12" r="9"/>` +
    `<circle cx="12" cy="12" r="6"/>` +
    `<circle cx="12" cy="12" r="3"/>` +
    `<path d="M12 3 Q14 5 14 7" stroke-width="1"/>` +
    `<path d="M21 12 Q19 10 17 10" stroke-width="1"/>` +
    `<path d="M12 21 Q10 19 10 17" stroke-width="1"/>`
  );
}

/** anchor — admiralty anchor with ring and stock */
function anchor(color: string, size: number): string {
  return svg(size, color,
    `<circle cx="12" cy="5" r="2"/>` +
    `<line x1="12" y1="7" x2="12" y2="20"/>` +
    `<path d="M6 11 L12 7 L18 11"/>` +
    `<path d="M6 20 Q12 23 18 20"/>` +
    `<line x1="6" y1="14" x2="9" y2="14"/>` +
    `<line x1="15" y1="14" x2="18" y2="14"/>`
  );
}

/** waveField — 3 parallel sine-wave strokes */
function waveField(color: string, size: number): string {
  return svg(size, color,
    `<path d="M2 8 Q5 5 8 8 Q11 11 14 8 Q17 5 20 8 Q22 10 22 8"/>` +
    `<path d="M2 13 Q5 10 8 13 Q11 16 14 13 Q17 10 20 13 Q22 15 22 13"/>` +
    `<path d="M2 18 Q5 15 8 18 Q11 21 14 18 Q17 15 20 18 Q22 20 22 18"/>`
  );
}

/** helm — ship's wheel with 8 spokes */
function helm(color: string, size: number): string {
  const spokes = [0, 45, 90, 135].map(deg => {
    const r = deg * Math.PI / 180;
    const x1 = 12 + 4 * Math.sin(r), y1 = 12 - 4 * Math.cos(r);
    const x2 = 12 + 9 * Math.sin(r), y2 = 12 - 9 * Math.cos(r);
    const x3 = 12 - 4 * Math.sin(r), y3 = 12 + 4 * Math.cos(r);
    const x4 = 12 - 9 * Math.sin(r), y4 = 12 + 9 * Math.cos(r);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>` +
           `<line x1="${x3.toFixed(1)}" y1="${y3.toFixed(1)}" x2="${x4.toFixed(1)}" y4="${y4.toFixed(1)}"/>`;
  }).join("");
  return svg(size, color,
    `<circle cx="12" cy="12" r="10"/>` +
    `<circle cx="12" cy="12" r="3" fill="${color}"/>` +
    spokes
  );
}

/** keelSection — fin keel profile with bulb, viewed from aft */
function keelSection(color: string, size: number): string {
  return svg(size, color,
    `<path d="M12 2 L12 16 Q10 20 8 21 Q12 23 16 21 Q14 20 12 16"/>` +
    `<ellipse cx="12" cy="21.5" rx="4" ry="1.5" fill="${color}" fill-opacity="0.3"/>`
  );
}

/** foilWing — swept horizontal foil cross-section, thin leading edge */
function foilWing(color: string, size: number): string {
  return svg(size, color,
    `<path d="M2 12 Q8 8 18 11 Q22 12 20 14 Q14 16 8 14 Q3 13 2 12 Z" fill="${color}" fill-opacity="0.15"/>` +
    `<path d="M2 12 Q8 8 18 11 Q22 12 20 14 Q14 16 8 14 Q3 13 2 12 Z"/>`
  );
}

/** catamaranPlan — two parallel hulls with crossbeam, top-down */
function catamaranPlan(color: string, size: number): string {
  return svg(size, color,
    `<path d="M4 7 Q6 4 8 7 L8 17 Q6 20 4 17 Z"/>` +
    `<path d="M16 7 Q18 4 20 7 L20 17 Q18 20 16 17 Z"/>` +
    `<line x1="8" y1="9" x2="16" y2="9"/>` +
    `<line x1="8" y1="15" x2="16" y2="15"/>` +
    `<line x1="12" y1="9" x2="12" y2="15" stroke-dasharray="2,2"/>`
  );
}

/** dinghySilhouette — centerboard dinghy side profile, boom out */
function dinghySilhouette(color: string, size: number): string {
  return svg(size, color,
    `<path d="M4 18 Q10 16 18 18 L16 21 Q10 22 4 21 Z" fill="${color}" fill-opacity="0.2"/>` +
    `<path d="M4 18 Q10 16 18 18 L16 21 Q10 22 4 21 Z"/>` +
    `<line x1="10" y1="18" x2="10" y2="5"/>` +
    `<path d="M10 5 L10 14 L18 18 Z" fill="${color}" fill-opacity="0.25"/>` +
    `<line x1="10" y1="14" x2="20" y2="17"/>` +
    `<line x1="12" y1="21" x2="12" y2="24"/>`
  );
}

/** starburst — 8-ray irregular starburst */
function starburst(color: string, size: number): string {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? 10 : 4.5;
    const a = (i * Math.PI) / 8;
    pts.push(`${(12 + r * Math.cos(a - Math.PI / 2)).toFixed(1)},${(12 + r * Math.sin(a - Math.PI / 2)).toFixed(1)}`);
  }
  return svgFill(size, color, `<polygon points="${pts.join(" ")}"/>`);
}

/** cruisingSpinnaker — symmetric spinnaker, full belly, twin guys */
function cruisingSpinnaker(color: string, size: number): string {
  return svg(size, color,
    `<line x1="12" y1="2" x2="12" y2="22"/>` +
    `<path d="M12 4 Q2 12 6 19 Q9 22 12 21 Q15 22 18 19 Q22 12 12 4 Z" fill="${color}" fill-opacity="0.15"/>` +
    `<path d="M12 4 Q2 12 6 19 Q9 22 12 21"/>` +
    `<path d="M12 4 Q22 12 18 19 Q15 22 12 21"/>` +
    `<line x1="6" y1="19" x2="3" y2="22"/>` +
    `<line x1="18" y1="19" x2="21" y2="22"/>`
  );
}

/** sailPanel — single sail panel with batten pockets as horizontal lines */
function sailPanel(color: string, size: number): string {
  return svg(size, color,
    `<path d="M6 20 L6 3 L20 18 Z" fill="${color}" fill-opacity="0.12"/>` +
    `<path d="M6 20 L6 3 L20 18 Z"/>` +
    `<line x1="6" y1="8.5" x2="13" y2="14.5"/>` +
    `<line x1="6" y1="12" x2="16" y2="16.5"/>` +
    `<line x1="6" y1="16" x2="18" y2="17.5"/>`
  );
}

/** chandleryWrench — marine wrench crossed with a shackle */
function chandleryWrench(color: string, size: number): string {
  return svg(size, color,
    `<path d="M4 20 L14 10 Q16 6 20 4 Q21 8 18 10 L8 20 Q6 22 4 22 Q2 22 2 20 Q2 18 4 20"/>` +
    `<path d="M15 6 Q18 4 20 4"/>` +
    `<circle cx="17" cy="7" r="2.5"/>` +
    `<path d="M19.5 7 Q20 9 19 10"/>`
  );
}

/** lifeRing — ring buoy, four quarter panels alternating */
function lifeRing(color: string, size: number): string {
  return svg(size, color,
    `<circle cx="12" cy="12" r="9"/>` +
    `<circle cx="12" cy="12" r="5"/>` +
    `<path d="M12 3 L12 7 M12 17 L12 21 M3 12 L7 12 M17 12 L21 12" stroke-width="2"/>` +
    `<path d="M12 3 A9 9 0 0 1 21 12" stroke-width="4" stroke="${color}"/>` +
    `<path d="M12 21 A9 9 0 0 1 3 12" stroke-width="4" stroke="${color}"/>`
  );
}

/** startingGun — simplified starter pistol with smoke puff */
function startingGun(color: string, size: number): string {
  return svg(size, color,
    `<rect x="4" y="11" width="11" height="6" rx="1"/>` +
    `<rect x="10" y="8" width="8" height="4" rx="1"/>` +
    `<path d="M18 10 L21 8"/>` +
    `<path d="M10 11 L10 8"/>` +
    `<path d="M19 7 Q21 5 20 3 M21 8 Q23 7 22 5 M18 6 Q19 4 17 3" stroke-width="1" opacity="0.6"/>` +
    `<rect x="6" y="17" width="4" height="2" rx="0.5"/>`
  );
}

/** regattaTrophy — minimal trophy cup silhouette, two handles */
function regattaTrophy(color: string, size: number): string {
  return svg(size, color,
    `<path d="M8 4 Q7 10 7 12 Q7 16 12 17 Q17 16 17 12 Q17 10 16 4 Z" fill="${color}" fill-opacity="0.15"/>` +
    `<path d="M8 4 Q7 10 7 12 Q7 16 12 17 Q17 16 17 12 Q17 10 16 4 Z"/>` +
    `<path d="M7 7 Q4 7 4 10 Q4 13 7 13"/>` +
    `<path d="M17 7 Q20 7 20 10 Q20 13 17 13"/>` +
    `<line x1="12" y1="17" x2="12" y2="20"/>` +
    `<line x1="8" y1="20" x2="16" y2="20"/>`
  );
}

/** collegePennant — long tapered pennant streamer, no notch */
function collegePennant(color: string, size: number): string {
  return svg(size, color,
    `<polygon points="2,4 22,12 2,20" fill="${color}" fill-opacity="0.2"/>` +
    `<polygon points="2,4 22,12 2,20"/>` +
    `<line x1="2" y1="3" x2="2" y2="21"/>`
  );
}

/** sunsetHorizon — semi-circle sun at flat horizon, two rays */
function sunsetHorizon(color: string, size: number): string {
  return svg(size, color,
    `<line x1="2" y1="15" x2="22" y2="15"/>` +
    `<path d="M6 15 A6 6 0 0 1 18 15"/>` +
    `<line x1="12" y1="4" x2="12" y2="7"/>` +
    `<line x1="4" y1="8" x2="6.5" y2="10"/>` +
    `<line x1="20" y1="8" x2="17.5" y2="10"/>` +
    `<path d="M4 18 Q8 16 12 18 Q16 20 20 18" stroke-width="1" opacity="0.5"/>`
  );
}

/** chartContour — two concentric irregular closed contours */
function chartContour(color: string, size: number): string {
  return svg(size, color,
    `<path d="M12 4 Q18 4 20 8 Q22 14 18 18 Q14 22 8 20 Q4 18 4 12 Q4 6 12 4 Z"/>` +
    `<path d="M12 8 Q16 8 17 11 Q18 15 15 17 Q12 19 9 17 Q7 15 7 12 Q7 8 12 8 Z"/>`
  );
}

/** windArrow — meteorological wind arrow with two barbs */
function windArrow(color: string, size: number): string {
  return svg(size, color,
    `<line x1="4" y1="12" x2="20" y2="12"/>` +
    `<polyline points="15,7 20,12 15,17"/>` +
    `<line x1="4" y1="12" x2="8" y2="8"/>` +
    `<line x1="4" y1="12" x2="8" y2="12"/>` +
    `<line x1="5" y1="12" x2="7.5" y2="10"/>`
  );
}

/** recordStopwatch — circular watch face with lightning bolt overlay */
function recordStopwatch(color: string, size: number): string {
  return svg(size, color,
    `<circle cx="12" cy="13" r="8"/>` +
    `<line x1="12" y1="5" x2="12" y2="3"/>` +
    `<line x1="10" y1="3" x2="14" y2="3"/>` +
    `<line x1="19" y1="6" x2="20.5" y2="4.5"/>` +
    `<polyline points="14,9 10,13 13,13 10,18" stroke-width="1.8" fill="none"/>`
  );
}

/** pennantString — three small triangular flags on a line */
function pennantString(color: string, size: number): string {
  return svg(size, color,
    `<line x1="2" y1="6" x2="22" y2="6"/>` +
    `<polygon points="4,6 10,6 4,13" fill="${color}" fill-opacity="0.7"/>` +
    `<polygon points="11,6 17,6 11,13" fill="${color}"/>` +
    `<polygon points="18,6 22,6 22,13" fill="${color}" fill-opacity="0.6"/>`
  );
}

/** cleatSideView — horizontal cleat profile, two horns */
function cleatSideView(color: string, size: number): string {
  return svg(size, color,
    `<rect x="3" y="11" width="18" height="4" rx="1"/>` +
    `<path d="M5 11 Q4 7 6 7 Q8 7 8 11"/>` +
    `<path d="M16 11 Q16 7 18 7 Q20 7 19 11"/>` +
    `<rect x="3" y="15" width="18" height="2" rx="0.5"/>`
  );
}

/** sextantArc — arc with index arm and horizon mirror */
function sextantArc(color: string, size: number): string {
  return svg(size, color,
    `<path d="M4 20 A10 10 0 0 1 20 20"/>` +
    `<line x1="12" y1="10" x2="4" y2="20"/>` +
    `<line x1="12" y1="10" x2="18" y2="17"/>` +
    `<circle cx="12" cy="10" r="1.5" fill="${color}"/>` +
    `<line x1="2" y1="20" x2="22" y2="20"/>` +
    `<rect x="10" y="15" width="4" height="3" rx="0.5"/>`
  );
}

/** mapPinWake — map pin with V-wake behind it */
function mapPinWake(color: string, size: number): string {
  return svg(size, color,
    `<path d="M12 2 Q16 2 18 6 Q20 10 16 14 L12 20 L8 14 Q4 10 6 6 Q8 2 12 2 Z" fill="${color}" fill-opacity="0.2"/>` +
    `<path d="M12 2 Q16 2 18 6 Q20 10 16 14 L12 20 L8 14 Q4 10 6 6 Q8 2 12 2 Z"/>` +
    `<circle cx="12" cy="9" r="2"/>` +
    `<path d="M8 21 Q12 23 16 21" stroke-width="1" opacity="0.6"/>` +
    `<path d="M6 22 Q12 25 18 22" stroke-width="1" opacity="0.4"/>`
  );
}

/** booksAlmanac — two stacked books plus a scroll */
function booksAlmanac(color: string, size: number): string {
  return svg(size, color,
    `<rect x="3" y="12" width="10" height="9" rx="0.5"/>` +
    `<rect x="5" y="9" width="10" height="9" rx="0.5"/>` +
    `<path d="M16 4 Q16 2 18 2 L21 2 Q21 4 21 16 Q19 17 17 16 Q16 15 16 14 Z"/>` +
    `<line x1="16" y1="2" x2="16" y2="16"/>` +
    `<line x1="7" y1="9" x2="7" y2="21"/>` +
    `<line x1="9" y1="9" x2="9" y2="21"/>`
  );
}

/** microphone — broadcast mic silhouette */
function microphone(color: string, size: number): string {
  return svg(size, color,
    `<rect x="9" y="2" width="6" height="10" rx="3"/>` +
    `<path d="M5 10 Q5 17 12 17 Q19 17 19 10"/>` +
    `<line x1="12" y1="17" x2="12" y2="22"/>` +
    `<line x1="8" y1="22" x2="16" y2="22"/>`
  );
}

/** superyachtProfile — sleek modern motor-sailer profile with tall rig */
function superyachtProfile(color: string, size: number): string {
  return svg(size, color,
    `<path d="M2 17 Q6 14 12 14 Q18 14 22 17 L21 19 Q16 20 12 20 Q8 20 3 19 Z" fill="${color}" fill-opacity="0.15"/>` +
    `<path d="M2 17 Q6 14 12 14 Q18 14 22 17 L21 19 Q16 20 12 20 Q8 20 3 19 Z"/>` +
    `<rect x="10" y="11" width="6" height="6" rx="0.5"/>` +
    `<rect x="7" y="13" width="4" height="4" rx="0.5"/>` +
    `<line x1="13" y1="2" x2="13" y2="11"/>` +
    `<path d="M13 4 L16 9 L13 9 Z" fill="${color}" fill-opacity="0.5"/>` +
    `<line x1="3" y1="19" x2="1" y2="21"/>` +
    `<line x1="21" y1="19" x2="23" y2="21"/>`
  );
}

// ─── Symbol Dispatch Table ───────────────────────────────────────────────────

const SYMBOLS: Record<SymbolName, (color: string, size: number) => string> = {
  burgee,
  olympicSail,
  oneDesign,
  grandPrixSpinnaker,
  compassRose,
  ropeCoil,
  anchor,
  waveField,
  helm,
  keelSection,
  foilWing,
  catamaranPlan,
  dinghySilhouette,
  starburst,
  cruisingSpinnaker,
  sailPanel,
  chandleryWrench,
  lifeRing,
  startingGun,
  regattaTrophy,
  collegePennant,
  sunsetHorizon,
  chartContour,
  windArrow,
  recordStopwatch,
  pennantString,
  cleatSideView,
  sextantArc,
  mapPinWake,
  booksAlmanac,
  microphone,
  superyachtProfile,
};

/** Render a named symbol to an inline SVG string. */
export function getSymbol(name: SymbolName, color = "currentColor", size = 24): string {
  return SYMBOLS[name](color, size);
}

// ─── SYMBOL_TAG_MAP ─────────────────────────────────────────────────────────

export const SYMBOL_TAG_MAP: Record<string, SymbolName> = {
  // Yacht clubs & club racing
  "yacht-club":         "burgee",
  "club-racing":        "burgee",
  "sailing-club":       "burgee",

  // Olympic / World Sailing
  "olympic-sailing":    "olympicSail",
  "world-sailing":      "olympicSail",
  "olympic-classes":    "olympicSail",
  "olympics":           "olympicSail",

  // One-design
  "one-design":         "oneDesign",
  "fleet-racing":       "oneDesign",

  // Grand Prix / IRC / ORC / Offshore
  "grand-prix":         "grandPrixSpinnaker",
  "irc":                "grandPrixSpinnaker",
  "orc":                "grandPrixSpinnaker",
  "ocean-racing":       "grandPrixSpinnaker",
  "offshore-racing":    "grandPrixSpinnaker",
  "bluewater":          "grandPrixSpinnaker",

  // Navigation / Offshore
  "navigation":         "compassRose",
  "offshore":           "compassRose",
  "passage-making":     "compassRose",
  "delivery":           "compassRose",

  // Seamanship
  "seamanship":         "ropeCoil",
  "rigging":            "ropeCoil",
  "knots":              "ropeCoil",

  // Anchoring / Cruising
  "anchoring":          "anchor",
  "cruising-anchor":    "anchor",
  "marina":             "anchor",

  // Body of water / Weather
  "body-of-water":      "waveField",
  "ocean":              "waveField",
  "sea-state":          "waveField",
  "weather":            "windArrow",
  "wind":               "windArrow",
  "forecasting":        "windArrow",
  "routing":            "windArrow",

  // Skipper / Profile
  "sailor":             "helm",
  "skipper":            "helm",
  "helmsman":           "helm",

  // Naval architecture / Keelboats
  "keelboat":           "keelSection",
  "naval-architecture": "keelSection",

  // Foiling
  "foiling":            "foilWing",
  "hydrofoil":          "foilWing",
  "ac75":               "foilWing",
  "americas-cup":       "foilWing",

  // Multihull
  "catamaran":          "catamaranPlan",
  "multihull":          "catamaranPlan",
  "trimaran":           "catamaranPlan",

  // Dinghy / Youth
  "dinghy":             "dinghySilhouette",
  "youth-sailing":      "dinghySilhouette",
  "board-boat":         "dinghySilhouette",

  // Solo / Single-handed
  "solo":               "starburst",
  "single-handed":      "starburst",
  "ilca":               "starburst",
  "laser":              "starburst",

  // Cruising lifestyle
  "cruising":           "cruisingSpinnaker",
  "liveaboard":         "cruisingSpinnaker",
  "bluewater-cruising": "cruisingSpinnaker",

  // Sail technology
  "sail-technology":    "sailPanel",
  "sail-makers":        "sailPanel",
  "sails":              "sailPanel",

  // Maintenance / Gear
  "maintenance":        "chandleryWrench",
  "gear":               "chandleryWrench",
  "boat-systems":       "chandleryWrench",

  // Safety
  "safety":             "lifeRing",
  "mob":                "lifeRing",
  "emergency":          "lifeRing",
  "man-overboard":      "lifeRing",

  // Race management
  "race-start":         "startingGun",
  "race-management":    "startingGun",
  "race-committee":     "startingGun",

  // Regattas / Championships
  "regatta":            "regattaTrophy",
  "championship":       "regattaTrophy",
  "regatta-results":    "regattaTrophy",
  "results":            "regattaTrophy",

  // College sailing
  "college-sailing":    "collegePennant",
  "icsa":               "collegePennant",
  "collegiate":         "collegePennant",

  // Destinations / Lifestyle
  "destinations":       "sunsetHorizon",
  "cruising-lifestyle": "sunsetHorizon",
  "tropical":           "sunsetHorizon",

  // Charts / Planning
  "charts":             "chartContour",
  "passage-planning":   "chartContour",
  "navigation-charts":  "chartContour",

  // Records
  "speed-records":      "recordStopwatch",
  "jules-verne":        "recordStopwatch",
  "records":            "recordStopwatch",

  // Events / Shows
  "boat-show":          "pennantString",
  "exhibition":         "pennantString",
  "festival":           "pennantString",

  // Dock / Berthing
  "dock":               "cleatSideView",
  "berthing":           "cleatSideView",
  "harbor":             "cleatSideView",

  // Classic / History
  "classic-sailing":    "sextantArc",
  "history":            "sextantArc",
  "celestial-navigation": "sextantArc",

  // Geographic / Local
  "region":             "mapPinWake",
  "local-sailing":      "mapPinWake",
  "geographic":         "mapPinWake",

  // Archive / Almanac
  "archive":            "booksAlmanac",
  "almanac":            "booksAlmanac",
  "historical-records": "booksAlmanac",

  // Media
  "podcast":            "microphone",
  "audio":              "microphone",
  "racing-radio":       "microphone",
  "cruising-radio":     "microphone",

  // Superyacht / Luxury
  "superyacht":         "superyachtProfile",
  "charter":            "superyachtProfile",
  "luxury-sail":        "superyachtProfile",
};

/**
 * Return the SVG string for a tag slug.
 * Falls back to waveField if the slug isn't in the map.
 */
export function getSymbolForTag(tagSlug: string, color = "currentColor", size = 24): string {
  const name: SymbolName = SYMBOL_TAG_MAP[tagSlug] ?? "waveField";
  return getSymbol(name, color, size);
}

/**
 * Return the SVG string for an entity type.
 * entity_type values match the entities table type enum.
 */
export function getSymbolForEntityType(entityType: string, color = "currentColor", size = 24): string {
  const entityMap: Record<string, SymbolName> = {
    boat_class:    "oneDesign",
    yacht_club:    "burgee",
    regatta:       "regattaTrophy",
    sailor:        "helm",
    body_of_water: "waveField",
    manufacturer:  "keelSection",
    region:        "mapPinWake",
    rating_system: "chartContour",
    sail_maker:    "sailPanel",
    sail_loft:     "sailPanel",
  };
  const name: SymbolName = entityMap[entityType] ?? "waveField";
  return getSymbol(name, color, size);
}
