/**
 * scripts/lib/print.ts
 * Shared CLI formatting helpers for all Sail Southern operational scripts.
 *
 * Design principles:
 * - Sections use ─ dividers for visual separation (5–7 per script max)
 * - Status lines use emoji prefix: ✅ ok, ⚠️ warn, ❌ fail
 * - Every failure should call printFixHint with an exact remediation step
 * - Never overwhelm: one line per event, detail only on failure
 *
 * Usage:
 *   import { printSection, printOk, printWarn, printFail, printFixHint, printBadge } from "./lib/print";
 */

const DIVIDER = "─".repeat(60);

/**
 * Print a section header with optional mode badge.
 * e.g. printSection("Daily newsletter", "LIVE")
 *      ────────────────────────────────────────────────────────────
 *        Daily newsletter  [LIVE]
 *      ────────────────────────────────────────────────────────────
 */
export function printSection(title: string, modeBadge?: string): void {
  console.log(`\n${DIVIDER}`);
  const badge = modeBadge ? `  [${modeBadge}]` : "";
  console.log(`  ${title}${badge}`);
  console.log(DIVIDER);
}

/** ✅ Success line — something completed normally */
export function printOk(msg: string): void {
  console.log(`  ✅ ${msg}`);
}

/** ⚠️ Warning line — non-fatal, informational */
export function printWarn(msg: string): void {
  console.log(`  ⚠️  ${msg}`);
}

/**
 * ❌ Failure line with optional fix hint.
 * Always provide a hint so the operator knows what to do.
 * e.g. printFail("Mastodon post did not publish.", "Check MASTODON_ACCESS_TOKEN in .env.")
 */
export function printFail(msg: string, hint?: string): void {
  console.error(`  ❌ ${msg}`);
  if (hint) {
    console.error(`     → ${hint}`);
  }
}

/**
 * Inline fix hint line — use after printWarn or printFail for multi-line remediations.
 * e.g. printFixHint("Add WAYBACK_ACCESS_KEY from https://archive.org/account/s3.php")
 */
export function printFixHint(hint: string): void {
  console.error(`     → ${hint}`);
}

/**
 * Inline mode/status badge.
 * badge("DRY RUN") → "  [DRY RUN — no changes will be made]"
 * badge("LIVE")    → "  [LIVE]"
 */
export function printBadge(text: string, type: "mode" | "status" | "info" = "mode"): void {
  const prefix = type === "mode" ? "" : "";
  const suffix = type === "mode" && text === "DRY RUN" ? " — no changes will be made" : "";
  console.log(`  [${prefix}${text}${suffix}]`);
}

/**
 * Summary block printed at the end of a run.
 * printSummary({ deliveries: 3, failures: 0, skipped: 0 })
 */
export function printSummary(counts: Record<string, number | string>): void {
  const parts = Object.entries(counts)
    .map(([k, v]) => `${k}: ${v}`)
    .join("  ·  ");
  console.log(`\n  Summary — ${parts}`);
}
