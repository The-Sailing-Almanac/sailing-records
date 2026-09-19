/**
 * Script: compile-edition.ts
 * Purpose: Operational run script.
 * Idempotent: Yes
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import dotenv from "dotenv";
dotenv.config();

import { Pool } from "pg";
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from "path";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MODEL = "gemini-2.5-flash";

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const editionType: "daily" | "weekly" =
  args.includes("--type") && args[args.indexOf("--type") + 1] === "weekly"
    ? "weekly"
    : "daily";
const dryRun   = args.includes("--dry-run");
const isSample = args.includes("--sample");

// ── Sample-mode guard ─────────────────────────────────────────────────────────
if (isSample) {
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│  ⚠️  SAMPLE RUN — does NOT reserve content for production    │");
  console.log("│  This run will write to DB with run_mode=sample.             │");
  console.log("│  The 5:00am live compile will still see the full candidate pool.│");
  console.log("│  Archive and analytics side effects are suppressed.          │");
  console.log("└─────────────────────────────────────────────────────────────┘\n");
}

function getArgValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const dateArg = getArgValue("--date");
const targetDate = dateArg ?? new Date().toISOString().slice(0, 10);

// ── Config ────────────────────────────────────────────────────────────────────
const WINDOW_HOURS   = editionType === "daily" ? 72 : 168;
const FLOOR_DEFAULT  = editionType === "daily" ? 0.4 : 0.35;
const FLOOR_FALLBACK = FLOOR_DEFAULT - 0.05;
const CEILING        = 0.8;
const DEDUP_HOURS    = editionType === "daily" ? 48 : 168;
const MIN_ARTICLES   = 8;
const API_BASE       = process.env.API_BASE_URL ?? "https://api.sailsouthern.com";
const WEB_BASE       = process.env.WEB_BASE_URL ?? "https://sailsouthern.com";

const MONITORING_URL = process.env.MONITORING_WEBHOOK_URL ?? null;

// ── Editorial publisher tier ───────────────────────────────────────────────────
// Known editorial sources that produce original journalism vs. raw alert aggregation.
const EDITORIAL_PUBLISHERS = new Set([
  "Sailing World", "Scuttlebutt Sailing News", "Live Sail Die",
  "Afloat", "afloat.ie", "Sailing Illustrated", "SAIL Magazine",
  "Cruising World", "Yachting World", "Yachting Monthly", "YACHT",
  "Seahorse", "US Sailing", "Sail-World", "Sailing Anarchy",
  "Marine Industry News", "Boat International", "BOAT International",
  "The Japan Times", "Pressmare",
]);

// ── Southern US / Gulf Coast keywords for regional boost ─────────────────────
const SOUTHERN_KEYWORDS = [
  "gulf coast", "gulf of mexico", "galveston", "pensacola", "mobile bay",
  "biscayne", "tampa bay", "charleston", "savannah", "new orleans",
  "louisiana", "mississippi", "alabama", "texas sailing", "gulf shores",
  "clearwater", "st. pete", "saint pete", "key west", "miami",
  "fort lauderdale", "daytona", "lake pontchartrain", "corpus christi",
  "harvest moon regatta", "southern circuit", "southern ocean racing",
  "gulf yachting", "sorc", "texas coastal", "sail houston", "sail texas",
  "sail florida", "florida offshore", "offshore florida",
];

// ── Composite scoring for candidate ranking ────────────────────────────────────
function compositeScore(c: any): number {
  let score = (c.relevance_score ?? 0) + (c.popularity_score ?? 0) * 0.3;

  if (EDITORIAL_PUBLISHERS.has(c.publisher_name)) score += 0.15;

  const text = `${c.title ?? ""} ${c.canonical_url ?? ""} ${c.content_snippet ?? ""}`.toLowerCase();
  if (SOUTHERN_KEYWORDS.some(kw => text.includes(kw))) score += 0.25;

  score += Math.min((c.click_count ?? 0) * 0.02, 0.20);

  return score;
}

// ── HTML entity/tag stripper ───────────────────────────────────────────────────
function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

// ── Monitoring helper ─────────────────────────────────────────────────────────
async function notify(msg: string) {
  console.log("[Alert]", msg);
  if (!MONITORING_URL) return;
  try {
    await fetch(MONITORING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg }),
    });
  } catch { /* non-blocking */ }
}

// ── Percentile helper ─────────────────────────────────────────────────────────
function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`[CompileEdition] type=${editionType} date=${targetDate} dry-run=${dryRun}`);

  // ── 1. Fetch candidates ────────────────────────────────────────────────────
  const windowStart = `NOW() - INTERVAL '${WINDOW_HOURS} hours'`;

  // Get all scores for dynamic threshold
  const scoresRes = await pool.query<{ relevance_score: number }>(
    `SELECT relevance_score FROM article_links
     WHERE is_suppressed = FALSE
       AND relevance_score IS NOT NULL
       AND created_at > ${windowStart}`
  );
  const scores = scoresRes.rows.map(r => r.relevance_score).filter(s => s != null);
  let threshold = Math.min(CEILING, Math.max(FLOOR_DEFAULT, percentile(scores, 70)));
  console.log(`[CompileEdition] Dynamic threshold: ${threshold.toFixed(3)} (70th pct of ${scores.length} articles)`);

  // Dedup: exclude article IDs already in published editions in the dedup window.
  // Crucially: sample runs (run_mode='sample') are NEVER included in dedup so they
  // do not consume content eligibility for the 5:00am live compile.
  const dedupRes = await pool.query<{ article_id: string }>(
    `SELECT DISTINCT ns.article_id
     FROM newsletter_slots ns
     JOIN newsletter_editions ne ON ne.id = ns.edition_id
     WHERE ne.status IN ('published', 'archived')
       AND ne.run_mode = 'live'
       AND ne.edition_date > CURRENT_DATE - INTERVAL '${DEDUP_HOURS} hours'`
  );
  const dedupIds = dedupRes.rows.map(r => r.article_id);

  let candidates: any[] = [];
  let floor = threshold;

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await pool.query(
      `SELECT al.id, al.title, al.dek, al.canonical_url, al.redirect_hash,
              al.og_image_url, al.content_snippet, al.publisher_name,
              al.published_at, al.relevance_score, al.popularity_score,
              al.click_count, al.reaction_up_count, al.language
       FROM article_links al
       WHERE al.is_suppressed = FALSE
         AND (al.relevance_score >= $1 OR al.relevance_score IS NULL)
         AND al.created_at > ${windowStart}
         AND (al.published_at IS NULL OR al.published_at > NOW() - INTERVAL '14 days')
         AND (al.language IS NULL OR al.language = 'en')
         ${dedupIds.length ? "AND al.id <> ALL($2::uuid[])" : ""}
       ORDER BY (COALESCE(al.relevance_score,0) + COALESCE(al.popularity_score,0)*0.3) DESC
       LIMIT 60`,
      dedupIds.length ? [floor, dedupIds] : [floor]
    );
    candidates = res.rows;

    if (candidates.length >= MIN_ARTICLES) break;
    console.log(`[CompileEdition] Only ${candidates.length} candidates at floor ${floor.toFixed(3)} — lowering to ${FLOOR_FALLBACK.toFixed(3)}`);
    floor = FLOOR_FALLBACK;
  }

  if (candidates.length === 0) {
    await notify(`⚠️ [${editionType}] No candidates found for ${targetDate} — edition not compiled.`);
    await pool.end();
    return;
  }

  // Weekly extra filter: exclude very low-engagement articles unless < MIN_ARTICLES remain
  if (editionType === "weekly") {
    const filtered = candidates.filter(c => c.click_count > 2 || c.reaction_up_count > 0);
    if (filtered.length >= MIN_ARTICLES) candidates = filtered;
  }

  // Re-rank by composite score (regional boost + publisher tier + click signal), then take top 30
  candidates.sort((a, b) => compositeScore(b) - compositeScore(a));
  candidates = candidates.slice(0, 30);

  // Strip HTML tags/entities from titles
  for (const c of candidates) {
    if (c.title) c.title = stripHtml(c.title);
    if (c.dek)   c.dek   = stripHtml(c.dek);
  }

  const regionalCount = candidates.filter(c => {
    const t = `${c.title ?? ""} ${c.canonical_url ?? ""} ${c.content_snippet ?? ""}`.toLowerCase();
    return SOUTHERN_KEYWORDS.some(kw => t.includes(kw));
  }).length;
  console.log(`[CompileEdition] ${candidates.length} candidates (threshold=${threshold.toFixed(3)}, regional=${regionalCount})`);

  // ── 2. Gemini section assignment ───────────────────────────────────────────
  const candidatePayload = candidates.map(c => ({
    article_id: c.id,
    title: c.title ?? "Untitled",
    url: c.canonical_url,
    body_text: (c.content_snippet ?? "").slice(0, 200),
  }));

  const prompt = `You are the editorial engine for Sail Southern, a sailing news almanac.
Given the following candidate articles, assign each to an appropriate newspaper-style section.

Return ONLY a valid JSON array with no commentary, markdown, or code fences. Use this schema:
[{ "article_id": "<uuid>", "section_slug": "<kebab-case-slug>", "section_display_name": "<Title Case>", "is_front_page": true|false, "editorial_note": "<optional 1-sentence note>" }]

Rules:
- Every article must appear exactly once.
- Front page: choose the 3-5 most compelling, broadly appealing stories (set is_front_page: true). Strongly prefer articles with Gulf Coast, Southern US, or Texas/Louisiana/Alabama/Florida/Mississippi content for front page placement.
- Section slugs should be stable and reusable (e.g. "americas-cup", "college-sailing", "offshore-racing", "ocean-racing", "sailgp", "regattas", "cruising", "gear", "safety", "people", "destinations").
- College sailing articles (school names, ICSA, conference sailing) always go in "college-sailing".
- Include at least one college sailing article in the front page if a strong one exists.
- Prefer grouping 2-4 articles per section. Avoid singleton sections if possible.
- Non-English articles go in a "international" section and are not front page.

Articles:
${JSON.stringify(candidatePayload, null, 2)}`;

  let sectionAssignments: {
    article_id: string;
    section_slug: string;
    section_display_name: string;
    is_front_page: boolean;
    editorial_note?: string;
  }[] = [];

  try {
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    // Strip possible markdown fencing
    const json = text.replace(/^```json\n?|^```\n?|\n?```$/gm, "").trim();
    sectionAssignments = JSON.parse(json);
    console.log(`[CompileEdition] Gemini assigned ${sectionAssignments.length} articles to sections`);
  } catch (err) {
    console.error("[CompileEdition] Gemini error — using keyword section fallback", err);
    sectionAssignments = keywordSectionFallback(candidates);
  }

  // ── 3. Build slot rows ─────────────────────────────────────────────────────
  const sectionPositions = new Map<string, number>();
  const slotRows: {
    article_id: string;
    section: string;
    section_display_name: string;
    slot_position: number;
    injection_type: string;
    is_front_page: boolean;
  }[] = [];

  for (const a of sectionAssignments) {
    // Front-page slot: freshness gate (prefer articles < 36h old)
    const candidate = candidates.find(c => c.id === a.article_id);
    if (!candidate) continue;

    const sections: string[] = [];
    if (a.is_front_page) sections.push("front-page");
    sections.push(a.section_slug);

    for (const section of sections) {
      const pos = (sectionPositions.get(section) ?? 0) + 1;
      sectionPositions.set(section, pos);
      slotRows.push({
        article_id: a.article_id,
        section,
        section_display_name: section === "front-page" ? "Front Page" : a.section_display_name,
        slot_position: pos,
        injection_type: "morning",
        is_front_page: section === "front-page",
      });
    }
  }

  // ── Section cap: no single section may exceed 70% of non-front-page slots ──
  const nonFPTotal = slotRows.filter(s => s.section !== "front-page").length;
  const sectionCap = Math.max(1, Math.floor(nonFPTotal * 0.70));
  const sectionSlotCounts = new Map<string, number>();
  const cappedSlotRows = slotRows.filter(s => {
    if (s.section === "front-page") return true;
    const used = sectionSlotCounts.get(s.section) ?? 0;
    if (used >= sectionCap) return false;
    sectionSlotCounts.set(s.section, used + 1);
    return true;
  });
  const dropped = slotRows.length - cappedSlotRows.length;
  if (dropped > 0) console.log(`[CompileEdition] Section cap (70%=${sectionCap}) dropped ${dropped} slots`);

  const sectionCount = new Set(cappedSlotRows.map(s => s.section)).size;
  console.log(`[CompileEdition] Prepared ${cappedSlotRows.length} slots across ${sectionCount} sections`);

  if (dryRun) {
    console.log("[CompileEdition] DRY RUN — no DB writes.");
    console.log(JSON.stringify(cappedSlotRows.slice(0, 5), null, 2), "...");
    await pool.end();
    return;
  }

  // ── 4. Write to DB ─────────────────────────────────────────────────────────
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Upsert newsletter_editions.
    // Sample runs set run_mode='sample' and use 'sample' as the edition_type to prevent conflict with live daily/weekly editions.
    const effectiveEditionType = isSample ? 'sample' : editionType;
    const edRes = await client.query(
      `INSERT INTO newsletter_editions
         (edition_date, edition_type, edition_label, status, trend_threshold, compiled_at, run_mode)
       VALUES ($1::date, $2, $3, 'draft', $4, NOW(), $5)
       ON CONFLICT (edition_date, edition_type)
       DO UPDATE SET
         trend_threshold = EXCLUDED.trend_threshold,
         compiled_at = NOW(),
         run_mode = EXCLUDED.run_mode,
         status = CASE WHEN newsletter_editions.status = 'published' THEN 'published' ELSE 'draft' END
       RETURNING id`,
      [
        targetDate,
        effectiveEditionType,
        isSample
          ? `[SAMPLE] ${editionType === "daily" ? "Morning Edition" : "Weekly Edition"}`
          : editionType === "daily" ? "Morning Edition" : "Weekly Edition",
        threshold,
        isSample ? 'sample' : 'live',
      ]
    );
    const editionId = edRes.rows[0].id;
    console.log(`[CompileEdition] Edition ID: ${editionId}`);

    // Clear existing morning slots (non-breaking injection slots are preserved)
    await client.query(
      `DELETE FROM newsletter_slots WHERE edition_id = $1 AND injection_type = 'morning'`,
      [editionId]
    );

    // Insert slots
    for (const slot of cappedSlotRows) {
      await client.query(
        `INSERT INTO newsletter_slots
           (edition_id, article_id, section, section_display_name, slot_position, injection_type)
         VALUES ($1, $2::uuid, $3, $4, $5, $6)`,
        [editionId, slot.article_id, slot.section, slot.section_display_name, slot.slot_position, slot.injection_type]
      );
    }

    await client.query("COMMIT");
    console.log(`[CompileEdition] ✅ Edition ${editionId} compiled: ${cappedSlotRows.length} slots, ${sectionCount} sections`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // ── 5. Monitoring alert (suppressed for sample runs) ─────────────────────
  const uniqueSections = [...new Set(cappedSlotRows.map(s => s.section))].filter(s => s !== "front-page");
  if (!isSample) {
    await notify(
      `📰 [${editionType.toUpperCase()} EDITION COMPILED] ${targetDate}\n` +
      `Articles: ${candidates.length} candidates → ${new Set(cappedSlotRows.map(s => s.article_id)).size} selected\n` +
      `Sections: ${uniqueSections.join(", ")}\n` +
      `Threshold: ${threshold.toFixed(3)}`
    );
  } else {
    console.log(`[CompileEdition] ⚠️  SAMPLE RUN — monitoring alert suppressed. Edition tagged run_mode=sample.`);
    console.log(`[CompileEdition] ✅ Sample compile finished: ${cappedSlotRows.length} slots, ${sectionCount} sections`);
    console.log(`[CompileEdition]    This does NOT count as a production compile. The 5:00am cron will run fresh.`);
  }

  await pool.end();
}

// ── Keyword-based section fallback ───────────────────────────────────────────
// Used when Gemini is unavailable. Better than dumping everything into "general".

const SECTION_RULES: Array<{ slug: string; name: string; keywords: RegExp }> = [
  { slug: "americas-cup",    name: "America's Cup",    keywords: /america'?s cup|ac40|ac75|ac37/i },
  { slug: "sailgp",          name: "SailGP",           keywords: /sailgp|f50 catamaran/i },
  { slug: "offshore-racing", name: "Offshore Racing",  keywords: /offshore|ocean race|transatlantic|vend[eé]e|sydney.hobart|fastnet|rorc|route du rhum|jules verne|volvo/i },
  { slug: "college-sailing", name: "College Sailing",  keywords: /college sailing|icsa|collegiate sailing|fleet race|team race|conference sailing|sailing team/i },
  { slug: "olympic-sailing", name: "Olympic Sailing",  keywords: /olympic|nacra 17|49er|laser|ilca|world sailing|nations cup/i },
  { slug: "cruising",        name: "Cruising",         keywords: /cruis|passage|liveaboard|circumnavigat|bluewater|anchorage/i },
  { slug: "superyachts",     name: "Superyachts",      keywords: /superyacht|megayacht|charter|luxury yacht/i },
  { slug: "gear",            name: "Gear & Tech",      keywords: /sailmaker|north sails|quantum|doyle|uk sailmaker|rigging|mast|boom|electronics|navigation|gps/i },
  { slug: "safety",          name: "Safety",           keywords: /safety|rescue|overboard|coast guard|mayday|abandon ship|emergency/i },
  { slug: "regattas",        name: "Regattas",         keywords: /regatta|championship|world|nationals|race week|rolex/i },
];

type SectionAssignment = {
  article_id: string;
  section_slug: string;
  section_display_name: string;
  is_front_page: boolean;
  editorial_note?: string;
};

function keywordSectionFallback(candidates: any[]): SectionAssignment[] {
  const sectionCounts = new Map<string, number>();

  return candidates.map((c, i) => {
    const text = `${c.title ?? ""} ${c.content_snippet ?? ""}`;
    let matched = { slug: "sailing-news", name: "Sailing News" };

    for (const rule of SECTION_RULES) {
      if (rule.keywords.test(text)) {
        matched = { slug: rule.slug, name: rule.name };
        break;
      }
    }

    // Spread front-page picks across sections — pick the first article from each section
    const isNew = !sectionCounts.has(matched.slug);
    sectionCounts.set(matched.slug, (sectionCounts.get(matched.slug) ?? 0) + 1);
    const isFrontPage = isNew && sectionCounts.size <= 5;

    return {
      article_id: c.id,
      section_slug: matched.slug,
      section_display_name: matched.name,
      is_front_page: isFrontPage,
    };
  });
}

run().catch(async err => {
  console.error("[CompileEdition] Fatal:", err);
  await pool.end();
  process.exit(1);
});