/**
 * scripts/gate-edition.ts
 *
 * Layer 2 editorial gate. Runs after compile-edition.ts writes a draft edition.
 * Checks the assembled content against the editorial policy using:
 *   - Layer 1: fast pattern matching (personal names, private repo links, build-diary phrases)
 *   - Layer 2: Claude API semantic check (AI tells, editorial prose, political content, etc.)
 *
 * Writes a detailed structured audit log to newsletter_editions.gate_notes.
 * Promotes the edition to 'approved' on pass, holds it on warn, leaves it as
 * 'draft' on block. Fires broadcastAlert on all outcomes.
 *
 * Usage:
 *   tsx scripts/gate-edition.ts [--edition-id <n>] [--type daily|weekly] [--dry-run]
 *
 * Exit codes:
 *   0 = pass or warn (edition approved or held for review — pipeline continues)
 *   1 = block or fatal error (operator action required)
 */

import dotenv from "dotenv";
dotenv.config();

import Anthropic from "@anthropic-ai/sdk";
import { pool, query, closePool } from "./lib/db.js";
import { broadcastAlert, AlertSeverity } from "./lib/notifications.js";
import { publishMastodonStatus } from "./lib/mastodon.js";
import { publishToX, publishToNostr, publishToBluesky } from "./lib/social-adapters.js";
import {
  GATE_POLICY_VERSION,
  PERSONAL_NAME_BLOCKLIST,
  PRIVATE_REPO_PATTERNS,
  AI_TELL_PHRASES,
  BUILD_DIARY_PHRASES,
  buildSystemPrompt,
} from "./lib/gate-policy.js";

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun       = args.includes("--dry-run");
const overrideWarn = args.includes("--override-warn"); // operator: publish a warn-level edition
const editionType  = (args.includes("--type") ? args[args.indexOf("--type") + 1] : "daily") as "daily" | "weekly";
const editionIdArg = args.includes("--edition-id")
  ? parseInt(args[args.indexOf("--edition-id") + 1], 10)
  : null;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("[Gate] ANTHROPIC_API_KEY is not set. Cannot run LLM gate.");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckStatus = "pass" | "warn" | "block";

interface CheckEvidence {
  excerpt: string;
  context: string;
}

interface CheckResult {
  check_id: string;
  check_name: string;
  surface_applies_to: string;
  severity_if_triggered: "warn" | "block";
  status: CheckStatus;
  description: string;
  evidence: CheckEvidence[];
}

interface LlmAnalysis {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  summary: string;
  raw_response_id: string;
}

interface GateAuditLog {
  gate_version: string;
  model: string;
  checked_at: string;
  processing_time_ms: number;
  edition_id: number;
  edition_date: string;
  edition_type: string;
  surface: string;
  content_length_chars: number;
  article_count: number;
  section_count: number;
  verdict: CheckStatus;
  overall_severity: AlertSeverity;
  checks: CheckResult[];
  llm_analysis: LlmAnalysis;
  summary: string;
  recommended_action: "approve" | "hold_for_review" | "block";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function excerptContext(content: string, phrase: string): string {
  const idx = content.toLowerCase().indexOf(phrase.toLowerCase());
  if (idx === -1) return "";
  const start = Math.max(0, idx - 60);
  const end   = Math.min(content.length, idx + phrase.length + 60);
  return "…" + content.slice(start, end).replace(/\n+/g, " ") + "…";
}

function resolveVerdict(checks: CheckResult[]): { verdict: CheckStatus; severity: AlertSeverity } {
  if (checks.some(c => c.status === "block")) return { verdict: "block", severity: "block" };
  if (checks.some(c => c.status === "warn"))  return { verdict: "warn",  severity: "warn"  };
  return { verdict: "pass", severity: "info" };
}

// ── DB fetch ──────────────────────────────────────────────────────────────────

async function fetchDraftEdition(idArg: number | null, type: string) {
  if (idArg) {
    const res = await query(
      `SELECT id, edition_date, edition_type, status, gate_status
       FROM newsletter_editions WHERE id = $1`,
      [idArg]
    );
    if (!res.rows[0]) throw new Error(`Edition ${idArg} not found.`);
    return res.rows[0];
  }
  const res = await query(
    `SELECT id, edition_date, edition_type, status, gate_status
     FROM newsletter_editions
     WHERE status = 'draft' AND edition_type = $1 AND run_mode = 'live'
     ORDER BY compiled_at DESC LIMIT 1`,
    [type]
  );
  if (!res.rows[0]) throw new Error(`No draft ${type} edition found.`);
  return res.rows[0];
}

async function fetchSlots(editionId: number) {
  const res = await query(
    `SELECT ns.section, ns.section_display_name, ns.slot_position,
            al.title, al.content_snippet, al.publisher_name, al.published_at,
            al.canonical_url, al.relevance_score
     FROM newsletter_slots ns
     JOIN article_links al ON al.id = ns.article_id
     WHERE ns.edition_id = $1 AND ns.is_active = TRUE
     ORDER BY
       CASE ns.section WHEN 'front-page' THEN 0 ELSE 1 END,
       ns.section, ns.slot_position`,
    [editionId]
  );
  return res.rows;
}

function buildAuditContent(edition: any, slots: any[]): {
  content: string;
  articleCount: number;
  sectionCount: number;
} {
  // Deduplicate by section (front-page duplicates slots from other sections)
  const seen = new Set<string>();
  const dedupedSlots = slots.filter(s => {
    if (s.section === "front-page") return false;
    const key = `${s.section}:${s.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const sectionMap = new Map<string, { displayName: string; articles: any[] }>();
  for (const slot of dedupedSlots) {
    if (!sectionMap.has(slot.section)) {
      sectionMap.set(slot.section, { displayName: slot.section_display_name, articles: [] });
    }
    sectionMap.get(slot.section)!.articles.push(slot);
  }

  const lines: string[] = [
    `Edition: ${edition.edition_type} — ${edition.edition_date}`,
    `Total articles: ${dedupedSlots.length}`,
    `Sections: ${sectionMap.size}`,
    "",
  ];

  for (const [, { displayName, articles }] of sectionMap) {
    lines.push(`## ${displayName}`);
    for (const a of articles) {
      lines.push(`### ${a.title ?? "Untitled"}`);
      if (a.content_snippet) lines.push(a.content_snippet.slice(0, 200));
      if (a.publisher_name) lines.push(`Source: ${a.publisher_name}`);
      lines.push("");
    }
  }

  return {
    content: lines.join("\n"),
    articleCount: dedupedSlots.length,
    sectionCount: sectionMap.size,
  };
}

// ── Layer 1: pattern checks ───────────────────────────────────────────────────

function runPatternChecks(content: string): CheckResult[] {
  const results: CheckResult[] = [];

  // Personal name blocklist
  const nameHits = PERSONAL_NAME_BLOCKLIST
    .filter(name => content.toLowerCase().includes(name.toLowerCase()))
    .map(name => ({ excerpt: name, context: excerptContext(content, name) }));
  results.push({
    check_id: "personal_names",
    check_name: "Personal Name Blocklist",
    surface_applies_to: "all",
    severity_if_triggered: "block",
    status: nameHits.length > 0 ? "block" : "pass",
    description: nameHits.length > 0
      ? `${nameHits.length} blocklisted name(s) found`
      : "No blocklisted names detected",
    evidence: nameHits,
  });

  // Private repo links
  const repoHits: CheckEvidence[] = [];
  for (const pattern of PRIVATE_REPO_PATTERNS) {
    const m = content.match(pattern);
    if (m) repoHits.push({ excerpt: m[0], context: excerptContext(content, m[0]) });
  }
  results.push({
    check_id: "private_repo_links",
    check_name: "Private Repository Links",
    surface_applies_to: "all",
    severity_if_triggered: "block",
    status: repoHits.length > 0 ? "block" : "pass",
    description: repoHits.length > 0 ? "Private repository link detected" : "No private repository links found",
    evidence: repoHits,
  });

  // Build-diary phrases
  const buildHits = BUILD_DIARY_PHRASES
    .filter(p => content.toLowerCase().includes(p.toLowerCase()))
    .map(p => ({ excerpt: p, context: excerptContext(content, p) }));
  results.push({
    check_id: "build_diary_language",
    check_name: "Build-Diary Language",
    surface_applies_to: "all",
    severity_if_triggered: "block",
    status: buildHits.length > 0 ? "block" : "pass",
    description: buildHits.length > 0
      ? `${buildHits.length} build-diary phrase(s) detected`
      : "No build-diary language found",
    evidence: buildHits,
  });

  // AI tell phrases — count density to determine severity
  const tellHits = AI_TELL_PHRASES
    .filter(p => content.toLowerCase().includes(p.toLowerCase()))
    .map(p => ({ excerpt: p, context: excerptContext(content, p) }));
  const tellStatus: CheckStatus = tellHits.length === 0 ? "pass"
    : tellHits.length >= 3 ? "block"
    : "warn";
  results.push({
    check_id: "ai_tell_phrases_pattern",
    check_name: "AI Tell Phrases (Pattern)",
    surface_applies_to: "all",
    severity_if_triggered: "block",
    status: tellStatus,
    description: tellHits.length === 0
      ? "No AI tell phrases found by pattern scan"
      : `${tellHits.length} AI tell phrase(s) detected — density ${tellHits.length >= 3 ? "HIGH (block)" : "LOW (warn)"}`,
    evidence: tellHits.slice(0, 10),
  });

  return results;
}

// ── Layer 2: LLM semantic check ───────────────────────────────────────────────

async function runLlmGate(content: string, surface: string, edition: any): Promise<{
  checks: CheckResult[];
  summary: string;
  recommended_action: "approve" | "hold_for_review" | "block";
  usage: any;
  response_id: string;
  elapsed_ms: number;
}> {
  const t0 = Date.now();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: buildSystemPrompt(),
        cache_control: { type: "ephemeral" },
      }
    ],
    messages: [
      {
        role: "user",
        content: `Surface type: ${surface}\nEdition date: ${edition.edition_date}\nEdition ID: ${edition.id}\nEdition type: ${edition.edition_type}\n\n---\n\n${content}`,
      }
    ],
  });

  const elapsed = Date.now() - t0;
  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = raw.replace(/^```json\n?|^```\n?|\n?```$/gm, "").trim();
  const parsed = JSON.parse(cleaned);

  return {
    checks: parsed.checks as CheckResult[],
    summary: parsed.summary as string,
    recommended_action: parsed.recommended_action as "approve" | "hold_for_review" | "block",
    usage: response.usage,
    response_id: response.id,
    elapsed_ms: elapsed,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const runStart = Date.now();
  console.log(`[Gate] type=${editionType} edition-id=${editionIdArg ?? "auto"} dry-run=${dryRun}`);

  const edition = await fetchDraftEdition(editionIdArg, editionType);
  console.log(`[Gate] Found edition ${edition.id} (${edition.edition_date}) — status=${edition.status}`);

  if (edition.status !== "draft") {
    console.log(`[Gate] Skipping — status is '${edition.status}', expected 'draft'.`);
    await closePool();
    return;
  }

  const slots = await fetchSlots(edition.id);
  const { content, articleCount, sectionCount } = buildAuditContent(edition, slots);
  const surface = (edition.edition_type === "daily" || edition.edition_type === "weekly")
    ? "daily_newsletter"
    : "blog_post";

  console.log(`[Gate] Auditing ${articleCount} articles across ${sectionCount} sections (${content.length} chars)`);

  // Layer 1 — pattern checks
  const patternChecks = runPatternChecks(content);
  const patternVerdict = resolveVerdict(patternChecks);
  console.log(`[Gate] Pattern verdict: ${patternVerdict.verdict}`);

  // Layer 2 — LLM gate (skip if pattern already hard-blocked, saves API cost)
  let llmResult: Awaited<ReturnType<typeof runLlmGate>> | null = null;
  if (patternVerdict.verdict !== "block") {
    console.log("[Gate] Running LLM semantic check via Claude API...");
    llmResult = await runLlmGate(content, surface, edition);
    console.log(`[Gate] LLM check complete in ${llmResult.elapsed_ms}ms — cache_read=${(llmResult.usage as any).cache_read_input_tokens ?? 0}`);
  } else {
    console.log("[Gate] Skipping LLM check — pattern gate triggered hard block.");
  }

  const allChecks = [...patternChecks, ...(llmResult?.checks ?? [])];

  // cta_presence is a structural placeholder during pre-launch — downgrade any warn
  // on that check so it never holds an edition by itself.
  const checksForVerdict = allChecks.map(c =>
    c.check_id === "cta_presence" && c.status === "warn"
      ? { ...c, status: "pass" as const, description: `(info) ${c.description}` }
      : c
  );
  const { verdict, severity } = resolveVerdict(checksForVerdict);

  // "approve" → flip newsletter_editions.status to 'published' so injection/archive
  // timers find it. gate_status tracks the gate verdict independently.
  const recommendedAction: "approve" | "hold_for_review" | "block" =
    verdict === "block" ? "block"
    : verdict === "warn" && !overrideWarn ? "hold_for_review"
    : "approve";

  if (overrideWarn && verdict === "warn") {
    console.log("[Gate] --override-warn flag set — promoting warn-level edition to approved.");
  }

  const auditLog: GateAuditLog = {
    gate_version: GATE_POLICY_VERSION,
    model: "claude-sonnet-4-6",
    checked_at: new Date().toISOString(),
    processing_time_ms: Date.now() - runStart,
    edition_id: edition.id,
    edition_date: edition.edition_date,
    edition_type: edition.edition_type,
    surface,
    content_length_chars: content.length,
    article_count: articleCount,
    section_count: sectionCount,
    verdict,
    overall_severity: severity,
    checks: allChecks,
    llm_analysis: llmResult
      ? {
          model: "claude-sonnet-4-6",
          input_tokens: llmResult.usage.input_tokens,
          output_tokens: llmResult.usage.output_tokens,
          cache_read_input_tokens: (llmResult.usage as any).cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: (llmResult.usage as any).cache_creation_input_tokens ?? 0,
          summary: llmResult.summary,
          raw_response_id: llmResult.response_id,
        }
      : {
          model: "none",
          input_tokens: 0,
          output_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          summary: "LLM check skipped — pattern gate triggered hard block before API call.",
          raw_response_id: "",
        },
    summary: llmResult?.summary
      ?? `Pattern gate blocked. Triggered: ${patternChecks.filter(c => c.status !== "pass").map(c => c.check_name).join(", ")}`,
    recommended_action: recommendedAction,
  };

  console.log(`[Gate] Final verdict: ${verdict.toUpperCase()} — ${recommendedAction}`);
  console.log(`[Gate] Checks summary:`);
  for (const c of allChecks) {
    if (c.status !== "pass") console.log(`  ${c.status.toUpperCase().padEnd(5)} ${c.check_name}: ${c.description}`);
  }

  if (dryRun) {
    console.log("\n[Gate] DRY RUN — no DB writes.\n");
    console.log(JSON.stringify(auditLog, null, 2));
    await closePool();
    process.exit(verdict === "block" ? 1 : 0);
    return;
  }

  // Persist audit and update edition status.
  // newStatus is 'published' on approve, 'draft' otherwise.
  // The CASE prevents downgrading an already-published edition if the gate is re-run.
  const newStatus = recommendedAction === "approve" ? "published" : "draft";
  await query(
    `UPDATE newsletter_editions
     SET gate_status      = $1,
         gate_notes       = $2::jsonb,
         gate_checked_at  = NOW(),
         status           = CASE
           WHEN $3::text = 'published'    THEN 'published'
           WHEN status    = 'published'   THEN 'published'
           ELSE status
         END
     WHERE id = $4`,
    [verdict, JSON.stringify(auditLog), newStatus, edition.id]
  );

  // Verify actual DB value (don't trust the variable — the bug this fixes was exactly that)
  const check = await query(
    "SELECT status FROM newsletter_editions WHERE id = $1",
    [edition.id]
  );
  const actualStatus = check.rows[0]?.status ?? "unknown";
  console.log(`[Gate] DB updated — edition ${edition.id}: gate_status=${verdict}, status=${actualStatus}`);

  // Alert with full detail
  const alertTitle = verdict === "block"
    ? "🚫 EDITION BLOCKED — Editorial Gate"
    : verdict === "warn"
    ? "⚠️ Edition Held for Review — Gate Warning"
    : "✅ Edition Approved — Gate Passed";

  const failingSummary = allChecks
    .filter(c => c.status !== "pass")
    .map(c => `${c.status.toUpperCase()}: ${c.check_name}`)
    .join("\n");

  await broadcastAlert({
    title: alertTitle,
    text: [
      `Edition ${edition.id} — ${edition.edition_date} (${edition.edition_type})`,
      `Articles: ${articleCount} | Sections: ${sectionCount}`,
      failingSummary || "All checks passed.",
      "",
      auditLog.summary,
    ].join("\n"),
    severity,
    fields: allChecks
      .filter(c => c.status !== "pass")
      .slice(0, 10)
      .map(c => ({ name: c.check_name, value: `${c.status.toUpperCase()}: ${c.description}`, inline: false })),
  });

  // Email broadcast — only on approve, only when subscribers exist
  if (recommendedAction === "approve") {
    await broadcastApprovedEdition(edition.id, edition.edition_date, edition.edition_type);
  }

  await closePool();
  process.exit(verdict === "block" ? 1 : 0);
}

// ── Email broadcast ───────────────────────────────────────────────────────────

async function broadcastApprovedEdition(
  editionId: number,
  editionDate: string,
  editionType: string
): Promise<void> {
  let articlesCount = 0;
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  // Get active confirmed subscribers
  const subRes = await query(
    `SELECT email FROM email_subscriptions
     WHERE is_active = TRUE AND confirmed_at IS NOT NULL`,
    []
  );
  const emails: string[] = subRes.rows.map((r: { email: string }) => r.email);

  if (emails.length === 0) {
    console.log("[Gate] No confirmed subscribers — skipping email broadcast.");
    return;
  }

  // Build simple HTML email from edition slots
  const slotsRes = await query(
    `SELECT al.title, al.redirect_hash, al.canonical_url,
            al.content_snippet, al.publisher_name, ns.section_display_name
     FROM newsletter_slots ns
     JOIN article_links al ON al.id = ns.article_id
     WHERE ns.edition_id = $1 AND ns.is_active = TRUE AND ns.section != 'front-page'
     ORDER BY ns.section, ns.slot_position`,
    [editionId]
  );

  articlesCount = slotsRes.rows.length;
  const apiBase = process.env.API_BASE_URL ?? "https://api.sailsouthern.com";
  const webBase = process.env.WEB_BASE_URL ?? "https://sailsouthern.com";
  const dateStr = new Date(editionDate).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const subject = `Sailing Almanac — ${dateStr}`;

  let articlesHtml = "";
  let lastSection = "";
  for (const row of slotsRes.rows) {
    if (row.section_display_name !== lastSection) {
      articlesHtml += `<h2 style="color:#0a6e8a;font-size:16px;text-transform:uppercase;letter-spacing:0.05em;margin:28px 0 8px 0;">${row.section_display_name}</h2>`;
      lastSection = row.section_display_name;
    }
    const link = row.redirect_hash
      ? `${apiBase}/sendit/${row.redirect_hash}?src=email`
      : row.canonical_url;
    articlesHtml += `
      <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #e5e7eb;">
        <a href="${link}" style="font-size:16px;font-weight:600;color:#111827;text-decoration:none;">${row.title ?? "Untitled"}</a>
        ${row.content_snippet ? `<p style="color:#6b7280;font-size:14px;margin:6px 0 4px 0;">${row.content_snippet.slice(0, 200)}…</p>` : ""}
        ${row.publisher_name ? `<span style="font-size:12px;color:#9ca3af;">${row.publisher_name}</span>` : ""}
      </div>`;
  }

  const html = `<!DOCTYPE html>
<html><body style="font-family:sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#111827;">
  <div style="border-bottom:2px solid #0a6e8a;padding-bottom:16px;margin-bottom:24px;">
    <h1 style="font-size:22px;margin:0;color:#0a6e8a;">Sailing Almanac</h1>
    <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${dateStr}</p>
  </div>
  ${articlesHtml}
  <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">
    <a href="${webBase}/daily/latest" style="color:#0a6e8a;">Read online</a> ·
    <a href="${webBase}/support" style="color:#0a6e8a;">Support</a> ·
    <a href="${apiBase}/api/v1/unsubscribe?email={{email}}" style="color:#9ca3af;">Unsubscribe</a>
  </div>
</body></html>`;

  const batchSize = 100;
  let sent = 0;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    await resend.batch.send(
      batch.map(to => ({
        from: "Sailing Almanac <hello@sailsouthern.com>",
        to,
        subject,
        html: html.replace("{{email}}", encodeURIComponent(to)),
      }))
    );
    sent += batch.length;
  }

  console.log(`[Gate] Email broadcast complete — sent to ${sent} subscribers.`);

  // Social broadcast — all platforms, all non-fatal
  const webBase = process.env.WEB_BASE_URL ?? "https://sailsouthern.com";
  const dateSlug = editionDate.split("T")[0];
  const queryRunner = (sql: string, params?: any[]) => pool.query(sql, params);

  // Mastodon / GoToSocial
  try {
    const mastodonText = `🗞️ Sailing Almanac — ${dateStr}\n\nToday's sailing news is up. ${webBase}/daily/${dateSlug}\n\n#sailing #news`;
    const result = await publishMastodonStatus(mastodonText);
    if (result) console.log(`[Gate] Mastodon: ${result.url}`);
    else console.log("[Gate] Mastodon skipped — token not set.");
  } catch (err: any) {
    console.warn(`[Gate] Mastodon failed (non-fatal): ${err.message}`);
  }

  // X / Twitter
  if (process.env.TWITTER_API_KEY && process.env.TWITTER_ACCESS_TOKEN) {
    try {
      const canonicalContent = { id: editionId, type: "newsletter" as const, title: `Sailing Almanac — ${dateStr}`, text: `Today's sailing news digest. ${articlesCount} stories.` };
      const res = await publishToX(queryRunner, 0, canonicalContent);
      console.log(`[Gate] X: ${res.externalUrl}`);
    } catch (err: any) {
      console.warn(`[Gate] X failed (non-fatal): ${err.message}`);
    }
  } else {
    console.log("[Gate] X skipped — credentials not set.");
  }

  // Nostr
  if (process.env.NOSTR_PRIVATE_KEY) {
    try {
      const canonicalContent = { id: editionId, type: "newsletter" as const, title: `Sailing Almanac — ${dateStr}`, text: `Today's sailing news digest. ${articlesCount} stories.` };
      const res = await publishToNostr(queryRunner, 0, canonicalContent);
      console.log(`[Gate] Nostr: ${res.externalUrl}`);
    } catch (err: any) {
      console.warn(`[Gate] Nostr failed (non-fatal): ${err.message}`);
    }
  } else {
    console.log("[Gate] Nostr skipped — private key not set.");
  }

  // Bluesky
  if (process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_PASSWORD) {
    try {
      const canonicalContent = { id: editionId, type: "newsletter" as const, title: `Sailing Almanac — ${dateStr}`, text: `Today's sailing news digest. ${articlesCount} stories.` };
      const res = await publishToBluesky(queryRunner, 0, canonicalContent);
      console.log(`[Gate] Bluesky: ${res.externalUrl}`);
    } catch (err: any) {
      console.warn(`[Gate] Bluesky failed (non-fatal): ${err.message}`);
    }
  } else {
    console.log("[Gate] Bluesky skipped — credentials not set.");
  }
}

run().catch(async err => {
  console.error("[Gate] Fatal:", err);
  await closePool();
  process.exit(1);
});
