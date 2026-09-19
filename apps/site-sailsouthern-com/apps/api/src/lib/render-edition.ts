/**
 * apps/api/src/lib/render-edition.ts
 *
 * Sprint 9B — Task B2: renderEdition()
 *
 * Converts newsletter_slots rows into a Markdown string for serving via the API.
 * Does NOT save to DB — caller handles persistence.
 *
 * LINK DOCTRINE: All article title links use /sendit/<hash>.
 *   OG images use direct source URL — never via /sendit/.
 * SCORING DOCTRINE: slot ordering respects slot_position (set by compile-edition).
 */

import { query } from "./db";

const API_BASE = process.env.API_BASE_URL ?? "https://api.sailsouthern.com";

interface SlotRow {
  article_id: string;
  title: string;
  redirect_hash: string | null;
  canonical_url: string;
  og_image_url: string | null;
  content_snippet: string | null;
  publisher_name: string | null;
  published_at: Date;
  section: string;
  section_display_name: string | null;
  slot_position: number;
}

function renderSlotMarkdown(slot: SlotRow): string[] {
  const lines: string[] = [];
  const hash = slot.redirect_hash;
  const articleUrl = hash
    ? `${API_BASE}/sendit/${hash}?src=web&utm_medium=web`
    : slot.canonical_url;

  // OG image: direct source URL per LINK DOCTRINE
  if (slot.og_image_url) {
    lines.push(`![${escMd(slot.title ?? "")}](${slot.og_image_url})`);
    lines.push("");
  }

  lines.push(`### [${escMd(slot.title ?? "Untitled")}](${articleUrl})`);

  if (slot.content_snippet) {
    const snippet = slot.content_snippet.slice(0, 120).replace(/\n/g, " ");
    lines.push(`${escMd(snippet)}…`);
  }

  const meta: string[] = [];
  if (slot.publisher_name) meta.push(slot.publisher_name);
  if (slot.published_at) {
    meta.push(new Date(slot.published_at).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    }));
  }
  if (meta.length) lines.push(`*${meta.join(" · ")}*`);
  lines.push("");
  return lines;
}

export async function renderEdition(editionId: number): Promise<string> {
  const rows = await query(
    `SELECT
       ns.article_id,
       al.title,
       al.redirect_hash,
       al.canonical_url,
       al.og_image_url,
       al.content_snippet,
       al.publisher_name,
       al.published_at,
       ns.section,
       ns.section_display_name,
       ns.slot_position
     FROM newsletter_slots ns
     JOIN article_links al ON al.id = ns.article_id
     WHERE ns.edition_id = $1
       AND ns.is_active = TRUE
     ORDER BY
       CASE ns.section WHEN 'front-page' THEN 0 ELSE 1 END,
       ns.section,
       ns.slot_position ASC`,
    [editionId]
  );

  if (rows.rows.length === 0) return "";

  // Group by section, preserving order
  const sections = new Map<string, { displayName: string; slots: SlotRow[] }>();
  for (const row of rows.rows) {
    const key = row.section;
    if (!sections.has(key)) {
      sections.set(key, {
        displayName: row.section_display_name ?? titleCase(key),
        slots: [],
      });
    }
    sections.get(key)!.slots.push(row);
  }

  const lines: string[] = [];

  for (const [sectionSlug, { displayName, slots }] of sections) {
    lines.push(`## ${displayName}`);
    lines.push("");

    for (const slot of slots) {
      lines.push(...renderSlotMarkdown(slot));
    }

    // Section footer with permanent link
    lines.push(`[More: ${displayName} →](/sections/${sectionSlug})`);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function escMd(s: string): string {
  return s.replace(/([[\]()\\`*_{}#.!|>])/g, "\\$1");
}
