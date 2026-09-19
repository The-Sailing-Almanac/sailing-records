---
title: "Brand Guide — Sail Regional News Network"
updated_at: "2026-06-09"
status: draft — awaiting hex verification against source files
---

# Brand Guide

## Hierarchy

```
The Sailing Almanac (sailingalmanac.org)
— Online Library of Congress for Sailing
— The master brand. The wheel.
│
└── Sail Regional News Network
    — The news distribution arm. Eight spokes.
    │
    ├── Sail Southern    sailsouthern.com        LIVE (proof of concept)
    ├── Sail Northern    —                       planned
    ├── Sail Eastern     —                       planned
    ├── Sail Western     —                       planned
    ├── Sail Midwestern  —                       planned
    ├── Sail Great Lakes —                       planned
    ├── Sail Inland      —                       planned
    └── Sail Inland Lakes —                      planned
```

---

## Master Brand — The Sailing Almanac

**Tagline:** Online Library of Congress for Sailing  
**Secondary line:** Slick. Modern. Trusted. The Established Authority in Sailing News.

### Mark
- Geometric sail + open book in authoritative shield frame
- Integrated compass rose (navigational prestige element)
- Scale-agnostic vectors — works from favicon to billboard

### Canonical Color Palette
These are the locked preference for all automated output (OG cards, email headers, social profiles).

| Name | Hex | Role |
|------|-----|------|
| Trusted Navy Blue | `#1B3D6F` | Primary — authority, precision |
| Premium Old Gold | `#B8922A` | Accent — stability, knowledge |
| Clean White | `#FFFFFF` | Clarity, reverse lockups |

> **Note:** Hex values extracted from brand kit images. Mark with VERIFY and cross-check against original Illustrator/Figma source before final production use.

### Extended Palette
For human-designed pieces only — not for automated output.

| Name | Hex | Use |
|------|-----|-----|
| Navy Light | `#2D6DA3` | Sail facet highlights, secondary fills |
| Navy Dark | `#0F2440` | Shadows, footer backgrounds |
| Gold Light | `#D4B05A` | Hover states, light text on dark |
| Gold Dark | `#8A6A1A` | Stamp effects, embossed feel |
| Sand | `#F5EFE0` | Warm off-white, paper/parchment |
| Slate | `#4A5568` | Body text on light backgrounds |

### Typography

Fonts identified by visual analysis of kit letterforms. No font names were printed on the source sheets — only generic descriptions ("GEOMETRIC SANS-SERIF", "AUTHORITATIVE SLAB-SERIF").

| Role | Font | Weight | Google Fonts |
|------|------|--------|-------------|
| Brand name, display headings, social callouts | **Bebas Neue** | 400 (single-weight) | [↗](https://fonts.google.com/specimen/Bebas+Neue) |
| Section labels, datelines, regional names, EST. 2026 | **Barlow Condensed** | 400 / 600 / 700 | [↗](https://fonts.google.com/specimen/Barlow+Condensed) |
| Website body, email prose, UI labels | **Montserrat** | 400 / 500 / 600 | [↗](https://fonts.google.com/specimen/Montserrat) |

**Identifying characteristics:**
- *Bebas Neue* — condensed bold all-caps, no stroke contrast, diagonal "A" crossbar, Art Deco geometry. Used for "THE SAILING ALMANAC", "NETWORK", "SAIL SOUTHERN REGIONAL NEWS"
- *Barlow Condensed* — condensed but slightly wider, uniform stroke weight. Used for kit annotation labels and secondary hierarchy
- *Montserrat* — geometric lowercase sans, moderate x-height, open apertures. Used for URLs, body copy, email

**CSS import (all three at once):**
```css
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700&family=Montserrat:wght@400;500;600&display=swap');
```

**CSS variables (from `tokens.ts → masterCSSVars()`):**
```css
--font-display: 'Bebas Neue', 'Arial Narrow', Impact, sans-serif;
--font-sub:     'Barlow Condensed', 'Arial Narrow', sans-serif;
--font-body:    'Montserrat', -apple-system, 'Segoe UI', sans-serif;
```

### Logo Modules
1. **Standalone Emblem** — mark only, no text
2. **Primary Typography Arch** — arched "THE SAILING ALMANAC" above mark
3. **Network Banner** — NETWORK / EST. 2026 / SAILINGALMANAC.ORG
4. **Primary Square Lockup** — emblem + stacked name + banner
5. **Primary Horizontal Lockup** — emblem left, name + URL right
6. **Monochrome Navy on White**
7. **Monochrome Gold on White**

---

## Regional Color System

Each regional child brand inherits the master mark and typography but carries a distinct color identity tied to its geography and sailing culture. The master navy/gold is always available for monochrome lockups.

| Region | Primary | Secondary | Geography |
|--------|---------|-----------|-----------|
| Sail Southern | Terracotta `#C4622D` | Deep Sand `#D4A574` | South & Gulf Coast |
| Sail Northern | Forest Green `#1F5C2E` | Slate Grey `#6B7C8E` | Pacific Northwest |
| Sail Eastern | Royal Blue `#1B4FA0` | Cherry Red `#C41E3A` | East Coast |
| Sail Western | Moody Indigo `#4B3B8C` | Coral Pink `#E8735A` | West Coast & Hawaii |
| Sail Midwestern | Deep Indigo `#2D2B7A` | Mint Green `#4DB89A` | Great Lakes |
| Sail Great Lakes | Cobalt Blue `#1560BD` | Sun Yellow `#F5C518` | Great Lakes Region |
| Sail Inland | Olive Green `#5A6E28` | Copper `#B87333` | Midcontinent |
| Sail Inland Lakes | Lake Teal `#2E8B9A` | Aqua `#40B4C8` | Inland Scow & Dinghy |

---

## Usage Rules

**Canonical (automated output — OG cards, email, social):**
- Use master navy + gold only
- Regional output: regional primary + white + master gold accent

**Extended (human-designed pieces):**
- Extended palette available at designer discretion
- Regional colorways may be mixed within a piece for network-level materials

**Never:**
- Mix regional colorways on a single regional site
- Use sky blue as a primary brand color (retired)
- Use "ESTWORK" — it's a typo; correct text is "NETWORK"

---

## Source Files
Brand kits generated 2026. Hex values need verification against original vector source before final production use. Mark any confirmed values by removing the `// VERIFY` comment in `docs/brand/tokens.ts`.
