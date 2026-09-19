/**
 * scripts/extract-brand-assets.ts
 *
 * Crops individual brand elements from the source kit sheets.
 * Run: npx tsx scripts/extract-brand-assets.ts
 *
 * Source sheets are 2816x1536. Coordinates verified by pixel-level probing.
 * Right-panel modules on sa-clean-kit start at x≈2190 (not 1740 as first estimated).
 * Regional colorway kit cards start at x≈560.
 */

import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC  = path.join(ROOT, "assets/brand/source");
const OUT  = path.join(ROOT, "assets/brand");

interface Crop {
  src:  string;
  dest: string;
  left: number;
  top:  number;
  width: number;
  height: number;
}

const CROPS: Crop[] = [

  // ── The Sailing Almanac — individual modules (sa-clean-kit.png) ─────────────
  // Right panel starts at x≈2190. Verified via pixel probes.

  {
    src: "sa-clean-kit.png",
    dest: "sailing-almanac/sa--emblem-only.png",
    left: 2310, top: 183, width: 430, height: 240,
  },
  {
    src: "sa-clean-kit.png",
    dest: "sailing-almanac/sa--typography-arch.png",
    left: 2210, top: 440, width: 600, height: 165,
  },
  {
    src: "sa-clean-kit.png",
    dest: "sailing-almanac/sa--banner-module.png",
    left: 2220, top: 660, width: 580, height: 150,
  },
  {
    src: "sa-clean-kit.png",
    dest: "sailing-almanac/sa--square-lockup-navy.png",
    left: 2105, top: 845, width: 290, height: 380,
  },
  {
    src: "sa-clean-kit.png",
    dest: "sailing-almanac/sa--horizontal-lockup-color.png",
    left: 2480, top: 850, width: 330, height: 280,
  },
  {
    src: "sa-clean-kit.png",
    dest: "sailing-almanac/sa--mono-navy.png",
    left: 2108, top: 1210, width: 340, height: 285,
  },
  {
    src: "sa-clean-kit.png",
    dest: "sailing-almanac/sa--mono-gold.png",
    left: 2460, top: 1210, width: 345, height: 285,
  },
  // Full center lockup (main logo, includes blueprint annotations by design)
  {
    src: "sa-clean-kit.png",
    dest: "sailing-almanac/sa--full-lockup.png",
    left: 480, top: 90, width: 1280, height: 1400,
  },

  // ── The Sailing Almanac — compass rose / network master (sa-compass-master.png) ──
  {
    src: "sa-compass-master.png",
    dest: "sailing-almanac/sa--compass-full-lockup.png",
    left: 290, top: 70, width: 1400, height: 1400,
  },
  {
    src: "sa-compass-master.png",
    dest: "sailing-almanac/sa--compass-square-navy.png",
    left: 2305, top: 70, width: 510, height: 155,
  },
  {
    src: "sa-compass-master.png",
    dest: "sailing-almanac/sa--compass-horizontal-color.png",
    left: 2305, top: 258, width: 510, height: 110,
  },
  // Network lockup = same master mark (NETWORK banner variant)
  {
    src: "sa-compass-master.png",
    dest: "sailing-almanac/sa--network-lockup.png",
    left: 290, top: 70, width: 1400, height: 1400,
  },

  // ── Sail Regional News Network — full master lockup (srnn-full-kit.png) ─────
  {
    src: "srnn-full-kit.png",
    dest: "sail-regional-news-network/srnn--full-lockup.png",
    left: 65, top: 65, width: 1400, height: 1420,
  },

  // ── Regional colorway kit cards (srnn-regional-colorways.png) ───────────────
  // Kit cards start at x≈560. 4 columns per row, each card ≈564px wide.
  // Row 1 (y 40–715): Southern, Northern, Eastern, Western
  // Row 2 (y 715–1515): Midwestern, Great Lakes, Inland, Inland Lakes

  // Kit cards start at x≈880. 4 columns of 484px each, right edge at 2816.
  { src: "srnn-regional-colorways.png", dest: "regions/sail-southern--kit.png",
    left: 880,  top: 40,  width: 484, height: 675 },
  { src: "srnn-regional-colorways.png", dest: "regions/sail-northern--kit.png",
    left: 1364, top: 40,  width: 484, height: 675 },
  { src: "srnn-regional-colorways.png", dest: "regions/sail-eastern--kit.png",
    left: 1848, top: 40,  width: 484, height: 675 },
  { src: "srnn-regional-colorways.png", dest: "regions/sail-western--kit.png",
    left: 2332, top: 40,  width: 484, height: 675 },
  { src: "srnn-regional-colorways.png", dest: "regions/sail-midwestern--kit.png",
    left: 880,  top: 715, width: 484, height: 800 },
  { src: "srnn-regional-colorways.png", dest: "regions/sail-great-lakes--kit.png",
    left: 1364, top: 715, width: 484, height: 800 },
  { src: "srnn-regional-colorways.png", dest: "regions/sail-inland--kit.png",
    left: 1848, top: 715, width: 484, height: 800 },
  { src: "srnn-regional-colorways.png", dest: "regions/sail-inland-lakes--kit.png",
    left: 2332, top: 715, width: 484, height: 800 },
];

async function run() {
  let ok = 0, failed = 0;
  for (const crop of CROPS) {
    const srcPath  = path.join(SRC, crop.src);
    const destPath = path.join(OUT, crop.dest);
    try {
      await sharp(srcPath)
        .extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })
        .png()
        .toFile(destPath);
      console.log(`✅ ${crop.dest}`);
      ok++;
    } catch (e: any) {
      console.error(`❌ ${crop.dest}: ${e.message}`);
      failed++;
    }
  }
  console.log(`\nDone — ${ok} extracted, ${failed} failed.`);
}

run();
