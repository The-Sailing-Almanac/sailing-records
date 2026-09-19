/**
 * Script: inject-breaking.ts
 * Purpose: Operational run script.
 * Idempotent: Yes
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import dotenv from "dotenv";
dotenv.config();
import { Pool } from "pg";
import { GoogleGenerativeAI } from "@google/generative-ai";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[inject-breaking] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MODEL = "gemini-2.5-flash";
const MONITORING_URL = process.env.MONITORING_WEBHOOK_URL ?? null;

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}
const windowArg = getArg("--window") ?? "6h";
const windowHours = parseInt(windowArg.replace("h", ""));
const editionIdArg = getArg("--edition-id");

// Injection type based on current UTC hour
function injectionType(): string {
  const h = new Date().getUTCHours();
  if (h >= 11 && h < 18) return "noon";
  if (h >= 18 && h < 23) return "6pm";
  return "11pm";
}

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

async function run() {
  console.log(`[InjectBreaking] window=${windowHours}h edition=${editionIdArg ?? "auto"}`);

  // ── 1. Resolve edition ────────────────────────────────────────────────────
  let editionId: number;
  if (editionIdArg) {
    editionId = parseInt(editionIdArg);
  } else {
    const today = new Date().toISOString().slice(0, 10);
    const edRes = await pool.query(
      `SELECT id FROM newsletter_editions
       WHERE edition_date = $1::date AND edition_type = 'daily'
         AND status = 'published'`,
      [today]
    );
    if (!edRes.rows[0]) {
      console.log("[InjectBreaking] No published edition for today — skipping.");
      await pool.end();
      return;
    }
    editionId = edRes.rows[0].id;
  }
  console.log(`[InjectBreaking] Edition ID: ${editionId}`);

  // ── 2. Find current edition article IDs to exclude ────────────────────────
  const currentSlotsRes = await pool.query(
    `SELECT ns.article_id, al.title, ns.section, ns.slot_position, ns.id AS slot_id
     FROM newsletter_slots ns
     JOIN article_links al ON al.id = ns.article_id
     WHERE ns.edition_id = $1 AND ns.is_active = TRUE AND ns.section = 'front-page'
     ORDER BY ns.slot_position`,
    [editionId]
  );
  const currentSlots = currentSlotsRes.rows;
  const currentIds = currentSlots.map(s => s.article_id);

  // ── 3. Find breaking article candidates ───────────────────────────────────
  const candidatesRes = await pool.query(
    `SELECT al.id, al.title, al.canonical_url, al.content_snippet,
            al.relevance_score, al.popularity_score, al.published_at
     FROM article_links al
     WHERE al.is_suppressed = FALSE
       AND al.created_at > NOW() - INTERVAL '${windowHours} hours'
       AND (al.relevance_score > 0.6 OR al.popularity_score > 0.5)
       ${currentIds.length ? "AND al.id <> ALL($1::uuid[])" : ""}
     ORDER BY (COALESCE(al.relevance_score,0) + COALESCE(al.popularity_score,0)*0.3) DESC
     LIMIT 20`,
    currentIds.length ? [currentIds] : []
  );
  const breakingCandidates = candidatesRes.rows;

  if (breakingCandidates.length === 0) {
    console.log("[InjectBreaking] No breaking candidates — nothing to inject.");
    await pool.end();
    return;
  }

  console.log(`[InjectBreaking] ${breakingCandidates.length} breaking candidates found`);

  // ── 4. Gemini injection decision ──────────────────────────────────────────
  const prompt = `You are the breaking news editor for Sail Southern, a sailing news almanac.
Current front-page slots:
${JSON.stringify(currentSlots.map(s => ({ slot_id: s.slot_id, article_id: s.article_id, title: s.title, position: s.slot_position })), null, 2)}

New breaking articles (published in the last ${windowHours}h):
${JSON.stringify(breakingCandidates.map(c => ({ article_id: c.id, title: c.title, snippet: (c.content_snippet ?? "").slice(0, 150) })), null, 2)}

Decide which breaking articles (if any) should replace front-page slots. Max 3 injections.
Return ONLY a JSON array (no markdown, no commentary):
[{ "inject_article_id": "<uuid>", "section_slug": "<slug>", "displace_article_id": "<uuid or null>", "rationale": "<one sentence>" }]

If nothing warrants injection, return an empty array: []`;

  let injections: {
    inject_article_id: string;
    section_slug: string;
    displace_article_id: string | null;
    rationale: string;
  }[] = [];

  try {
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/^```json\n?|^```\n?|\n?```$/gm, "").trim();
    injections = JSON.parse(text);
    console.log(`[InjectBreaking] Gemini suggests ${injections.length} injection(s)`);
  } catch (err) {
    console.error("[InjectBreaking] Gemini error — skipping injections", err);
    await pool.end();
    return;
  }

  if (injections.length === 0) {
    console.log("[InjectBreaking] Gemini: no injections warranted.");
    await pool.end();
    return;
  }

  // ── 5. Apply injections ───────────────────────────────────────────────────
  const injType = injectionType();
  const injectedTitles: string[] = [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const inj of injections.slice(0, 3)) {
      // Displace existing slot
      if (inj.displace_article_id) {
        await client.query(
          `UPDATE newsletter_slots
           SET is_active = FALSE, bumped_to_section = $1, bumped_at = NOW()
           WHERE edition_id = $2 AND article_id = $3::uuid AND is_active = TRUE`,
          [inj.section_slug, editionId, inj.displace_article_id]
        );
      }

      // Find next position for section
      const posRes = await client.query(
        `SELECT COALESCE(MAX(slot_position), 0) + 1 AS next_pos
         FROM newsletter_slots
         WHERE edition_id = $1 AND section = 'front-page'`,
        [editionId]
      );
      const nextPos = posRes.rows[0].next_pos;

      // Insert new slot
      await client.query(
        `INSERT INTO newsletter_slots
           (edition_id, article_id, section, section_display_name, slot_position, injection_type, injected_at)
         VALUES ($1, $2::uuid, 'front-page', 'Front Page', $3, $4, NOW())`,
        [editionId, inj.inject_article_id, nextPos, injType]
      );

      const injectingArticle = breakingCandidates.find(c => c.id === inj.inject_article_id);
      injectedTitles.push(injectingArticle?.title ?? inj.inject_article_id);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  console.log(`[InjectBreaking] ✅ Injected ${injectedTitles.length} article(s)`);
  await notify(
    `🚨 [BREAKING INJECT — ${injType.toUpperCase()}] ${injections.length} article(s) injected:\n` +
    injectedTitles.map((t, i) => `  ${i + 1}. ${t}`).join("\n")
  );

  await pool.end();
}

run().catch(async err => {
  console.error("[InjectBreaking] Fatal:", err);
  await pool.end();
  process.exit(1);
});