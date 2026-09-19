/**
 * docs/brand/tokens.ts
 *
 * Sail Regional News Network — Brand Token System
 * Single source of truth for all color, typography, and identity values.
 *
 * CANONICAL values are the locked preference — use these for OG cards,
 * email headers, social profiles, and any automated output.
 *
 * EXTENDED palettes are for human designers who need flexibility
 * (e.g. a campaign, a printed piece, a dark-mode variant).
 *
 * Hex values extracted from master brand kit (2026). Mark with // VERIFY
 * if you want to cross-check against the original Illustrator/Figma source.
 */

// ─── Master Brand ──────────────────────────────────────────────────────────────

export const MASTER = {
  name: "The Sailing Almanac",
  tagline: "Online Library of Congress for Sailing",
  url: "https://sailingalmanac.org",
  estYear: 2026,

  colors: {
    // Canonical set — the locked preference
    navy:  "#1B3D6F",   // Trusted Navy Blue — authority, precision // VERIFY
    gold:  "#B8922A",   // Premium Old Gold — stability, knowledge  // VERIFY
    white: "#FFFFFF",   // Clean White — clarity

    // Extended — for designed pieces only, not automated output
    navyLight:  "#2D6DA3",   // Sail facet highlight, secondary fill
    navyDark:   "#0F2440",   // Deep shadow, footer backgrounds
    goldLight:  "#D4B05A",   // Hover states, light gold text
    goldDark:   "#8A6A1A",   // Dark gold, stamp effects
    sand:       "#F5EFE0",   // Warm off-white for paper/parchment feels
    slate:      "#4A5568",   // Body text on light backgrounds
  },

  typography: {
    // ── Primary display — brand name, navigation headings, social callouts
    // Visual ID: condensed bold all-caps, Art Deco geometry, no stroke contrast,
    //            diagonal A crossbar, slightly tapered stems.
    // Google Fonts: https://fonts.google.com/specimen/Bebas+Neue
    display: {
      family:  "Bebas Neue",
      fallback: "'Arial Narrow', 'Impact', sans-serif",
      weight:  400,        // Bebas Neue is single-weight; use Pro Heavy (700) if licensed
      style:   "normal",
      import:  "https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap",
    },

    // ── Secondary / subheadings — section labels, datelines, regional names
    // Visual ID: condensed, slightly wider than display, uniform stroke weight.
    // Google Fonts: https://fonts.google.com/specimen/Barlow+Condensed
    sub: {
      family:  "Barlow Condensed",
      fallback: "'Arial Narrow', sans-serif",
      weight:  600,        // SemiBold for hierarchy; 400 Regular for captions
      style:   "normal",
      import:  "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&display=swap",
    },

    // ── Body / UI — website prose, email body, annotation labels
    // Visual ID: geometric lowercase sans, moderate x-height, open apertures.
    // Google Fonts: https://fonts.google.com/specimen/Montserrat
    body: {
      family:  "Montserrat",
      fallback: "'-apple-system', 'Segoe UI', sans-serif",
      weight:  400,        // Regular for prose; 500 Medium for UI labels; 600 SemiBold for CTAs
      style:   "normal",
      import:  "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&display=swap",
    },
  },
} as const;


// ─── Network ───────────────────────────────────────────────────────────────────

export const NETWORK = {
  name: "Sail Regional News Network",
  tagline: "Slick. Modern. Trusted.",
  url: "https://sailingalmanac.org",
  // Inherits master navy/gold — no independent color shift at network level
  colors: MASTER.colors,
} as const;


// ─── Regional Children ─────────────────────────────────────────────────────────
// Each spoke inherits the master mark but has a distinct regional colorway.
// primary   = dominant regional color (backgrounds, headers)
// secondary = accent (highlights, badges, borders)
// All regions also have access to MASTER.colors for monochrome lockups.

export const REGIONS = {

  southern: {
    name: "Sail Southern",
    subtitle: "South & Gulf Coast",
    url: "https://sailsouthern.com",
    status: "live",
    colors: {
      primary:   "#C4622D",   // Terracotta
      secondary: "#D4A574",   // Deep Sand
      // Extended
      primaryDark:  "#8E3F18",
      primaryLight: "#E8956A",
    },
  },

  northern: {
    name: "Sail Northern",
    subtitle: "Pacific Northwest",
    url: null,
    status: "planned",
    colors: {
      primary:   "#1F5C2E",   // Deep Forest Green
      secondary: "#6B7C8E",   // Cool Slate Grey
      primaryDark:  "#0F3318",
      primaryLight: "#3A8C52",
    },
  },

  eastern: {
    name: "Sail Eastern",
    subtitle: "East Coast",
    url: null,
    status: "planned",
    colors: {
      primary:   "#1B4FA0",   // Nautical Royal Blue
      secondary: "#C41E3A",   // Cherry Red
      primaryDark:  "#0F2D60",
      primaryLight: "#3470C8",
    },
  },

  western: {
    name: "Sail Western",
    subtitle: "West Coast & Hawaii",
    url: null,
    status: "planned",
    colors: {
      primary:   "#4B3B8C",   // Moody Indigo
      secondary: "#E8735A",   // Coral Pink
      primaryDark:  "#2C2254",
      primaryLight: "#7060B8",
    },
  },

  midwestern: {
    name: "Sail Midwestern",
    subtitle: "Great Lakes Region",
    url: null,
    status: "planned",
    colors: {
      primary:   "#2D2B7A",   // Deep Indigo
      secondary: "#4DB89A",   // Fresh Mint Green
      primaryDark:  "#18174A",
      primaryLight: "#4A48A8",
    },
  },

  greatLakes: {
    name: "Sail Great Lakes",
    subtitle: "Great Lakes Region",
    url: null,
    status: "planned",
    colors: {
      primary:   "#1560BD",   // Cobalt Blue
      secondary: "#F5C518",   // Sun Yellow
      primaryDark:  "#0A3A7A",
      primaryLight: "#3A80D8",
    },
  },

  inland: {
    name: "Sail Inland",
    subtitle: "Midcontinent",
    url: null,
    status: "planned",
    colors: {
      primary:   "#5A6E28",   // Olive Green
      secondary: "#B87333",   // Copper
      primaryDark:  "#344018",
      primaryLight: "#7E9838",
    },
  },

  inlandLakes: {
    name: "Sail Inland Lakes",
    subtitle: "Inland Scow & Dinghy",
    url: null,
    status: "planned",
    colors: {
      primary:   "#2E8B9A",   // Lake-Water Teal
      secondary: "#40B4C8",   // Aqua
      primaryDark:  "#1A5560",
      primaryLight: "#50AEBE",
    },
  },

} as const;


// ─── Convenience exports ───────────────────────────────────────────────────────

export type RegionKey = keyof typeof REGIONS;

export const REGION_KEYS: RegionKey[] = [
  "southern", "northern", "eastern", "western",
  "midwestern", "greatLakes", "inland", "inlandLakes",
];

/** Get full brand config for any region */
export function getRegion(key: RegionKey) {
  return REGIONS[key];
}

/** CSS custom properties string — inject into :root for web use */
export function masterCSSVars(): string {
  const t = MASTER.typography;
  return `
  --color-navy:       ${MASTER.colors.navy};
  --color-navy-light: ${MASTER.colors.navyLight};
  --color-navy-dark:  ${MASTER.colors.navyDark};
  --color-gold:       ${MASTER.colors.gold};
  --color-gold-light: ${MASTER.colors.goldLight};
  --color-gold-dark:  ${MASTER.colors.goldDark};
  --color-white:      ${MASTER.colors.white};
  --color-sand:       ${MASTER.colors.sand};
  --color-slate:      ${MASTER.colors.slate};
  --font-display:     '${t.display.family}', ${t.display.fallback};
  --font-sub:         '${t.sub.family}', ${t.sub.fallback};
  --font-body:        '${t.body.family}', ${t.body.fallback};
  `.trim();
}

/** All Google Fonts @import lines needed for the full brand system */
export function googleFontsImports(): string {
  const t = MASTER.typography;
  return [t.display.import, t.sub.import, t.body.import].join("\n");
}

/** CSS custom properties for a specific regional brand */
export function regionCSSVars(key: RegionKey): string {
  const r = REGIONS[key];
  return `
  --color-regional-primary:        ${r.colors.primary};
  --color-regional-primary-dark:   ${r.colors.primaryDark};
  --color-regional-primary-light:  ${r.colors.primaryLight};
  --color-regional-secondary:      ${r.colors.secondary};
  `.trim();
}
