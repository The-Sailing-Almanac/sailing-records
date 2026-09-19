# Symbol Library

32 named nautical SVG symbols. Each is a pure TypeScript function returning an inline SVG string.
No external image files, no raster images, no `<image>` elements.

**File:** `apps/web/src/lib/symbols.ts`  
**Component:** `apps/web/src/app/components/Symbol.tsx`

## Usage

```tsx
import Symbol from "@/app/components/Symbol";
import { getSymbol, getSymbolForTag, getSymbolForEntityType } from "@/lib/symbols";

// React component
<Symbol name="helm" size={32} color="var(--primary)" />

// Raw SVG string (for email templates, non-React contexts)
const svg = getSymbol("burgee", "#0a6e8a", 48);

// By tag slug
const svg = getSymbolForTag("college-sailing", "#003087", 24);

// By entity type
const svg = getSymbolForEntityType("yacht_club", "currentColor", 24);
```

## Symbol Catalog

| # | Name | Shape Description | Tag Categories |
|---|---|---|---|
| 1 | `burgee` | Triangular pennant with swallowtail notch at fly end | yacht-club, club-racing, sailing-club |
| 2 | `olympicSail` | Three overlapping circles forming a triangle sail silhouette | olympic-sailing, world-sailing, olympic-classes |
| 3 | `oneDesign` | Two identical parallel hull profiles side-by-side | one-design, fleet-racing |
| 4 | `grandPrixSpinnaker` | Asymmetric spinnaker balloon, raked mast, full hoist | grand-prix, irc, orc, ocean-racing, offshore-racing |
| 5 | `compassRose` | 8-point minimal compass, cardinal points only | navigation, offshore, passage-making |
| 6 | `ropeCoil` | Top-view flemish flake circular coil | seamanship, rigging, knots |
| 7 | `anchor` | Admiralty anchor with ring and stock | anchoring, marina |
| 8 | `waveField` | 3 parallel sine-wave strokes | body-of-water, ocean, sea-state (default fallback) |
| 9 | `helm` | Ship's wheel with 8 spokes | sailor, skipper, helmsman |
| 10 | `keelSection` | Fin keel profile with bulb, viewed from aft | keelboat, naval-architecture, manufacturer |
| 11 | `foilWing` | Swept horizontal foil cross-section, thin leading edge | foiling, hydrofoil, ac75, americas-cup |
| 12 | `catamaranPlan` | Two parallel hulls with crossbeam, top-down | catamaran, multihull, trimaran |
| 13 | `dinghySilhouette` | Centerboard dinghy side profile, boom out | dinghy, youth-sailing, board-boat |
| 14 | `starburst` | 8-ray irregular starburst | solo, single-handed, ilca, laser |
| 15 | `cruisingSpinnaker` | Symmetric spinnaker, full belly, twin guys | cruising, liveaboard, bluewater-cruising |
| 16 | `sailPanel` | Single sail panel with batten pockets as horizontal lines | sail-technology, sail-makers, sails |
| 17 | `chandleryWrench` | Marine wrench crossed with a shackle | maintenance, gear, boat-systems |
| 18 | `lifeRing` | Ring buoy, four quarter panels alternating | safety, mob, emergency, man-overboard |
| 19 | `startingGun` | Simplified starter pistol with smoke puff | race-start, race-management, race-committee |
| 20 | `regattaTrophy` | Minimal trophy cup silhouette, two handles | regatta, championship, regatta-results, results |
| 21 | `collegePennant` | Long tapered pennant streamer, no notch | college-sailing, icsa, collegiate |
| 22 | `sunsetHorizon` | Semi-circle sun at flat horizon, two rays | destinations, cruising-lifestyle, tropical |
| 23 | `chartContour` | Two concentric irregular closed contours | charts, passage-planning, navigation-charts |
| 24 | `windArrow` | Meteorological wind arrow with two barbs | weather, wind, forecasting, routing |
| 25 | `recordStopwatch` | Circular watch face with lightning bolt overlay | speed-records, jules-verne, records |
| 26 | `pennantString` | Three small triangular flags on a line | boat-show, exhibition, festival |
| 27 | `cleatSideView` | Horizontal cleat profile, two horns | dock, berthing, harbor |
| 28 | `sextantArc` | Arc with index arm and horizon mirror | classic-sailing, history, celestial-navigation |
| 29 | `mapPinWake` | Map pin with V-wake behind it | region, local-sailing, geographic |
| 30 | `booksAlmanac` | Two stacked books plus a scroll | archive, almanac, historical-records |
| 31 | `microphone` | Broadcast mic silhouette | podcast, audio, racing-radio, cruising-radio |
| 32 | `superyachtProfile` | Sleek modern motor-sailer profile with tall rig | superyacht, charter, luxury-sail |

## Entity Type Mapping

| Entity type (DB) | Symbol |
|---|---|
| `boat_class` | `oneDesign` |
| `yacht_club` | `burgee` |
| `regatta` | `regattaTrophy` |
| `sailor` | `helm` |
| `body_of_water` | `waveField` |
| `manufacturer` | `keelSection` |
| `region` | `mapPinWake` |
| `rating_system` | `chartContour` |
| `sail_maker` | `sailPanel` |
| `sail_loft` | `sailPanel` |

## Default Fallback

If a tag slug has no mapping in `SYMBOL_TAG_MAP`, `getSymbolForTag()` returns `waveField`.

## Adding a Symbol

1. Add the function to `symbols.ts` following the `(color, size) => string` signature
2. Add it to the `SYMBOLS` dispatch table
3. Add it to the `SymbolName` union type
4. Map relevant tag slugs in `SYMBOL_TAG_MAP`
5. Document it in this table
