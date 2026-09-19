/**
 * Script: generate-daily-newsletter.ts
 * Purpose: Compile and broadcast the daily Sailing Almanac edition.
 * Idempotent: Yes
 * Dry-run: --dry-run flag generates and logs content but skips saving and sending.
 * Date override: --date YYYY-MM-DD targets a specific edition date (retroactive).
 * Last updated: 2026-05-29
 */
import { pool, closePool } from "./lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Resend } from "resend";
import dotenv from "dotenv";
import { broadcastAlert } from "./lib/notifications";
import crypto from "crypto";
import { nip19 } from "nostr-tools";
import { finalizeEvent } from "nostr-tools/pure";
import { Relay } from "nostr-tools/relay";
import { publishToMastodon, publishToNostr, publishToBluesky } from "./lib/social-adapters";
import { sendGA4Event } from "@stax/activity-core";
import { printSection, printOk, printWarn, printFail, printFixHint, printSummary } from "./lib/print";
import { execSync } from "child_process";
import path from "path";


dotenv.config();

// ─── Args ─────────────────────────────────────────────────────────────────────
const isDryRun = process.argv.includes("--dry-run");
const args = process.argv.slice(2);
function getArgValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}
const dateArg = getArgValue("--date");
const targetDate = dateArg ? new Date(`${dateArg}T12:00:00Z`) : new Date();
const titleDate = dateArg || new Date().toISOString().split("T")[0];
const isRetroactive = dateArg !== undefined;

const API_BASE = process.env.API_BASE_URL ?? "https://api.sailsouthern.com";
const relays = (process.env.NOSTR_RELAYS || "wss://relay.damus.io,wss://nos.lol").split(",");

// ─── Nostr helpers ────────────────────────────────────────────────────────────
function parseNostrPrivateKey(keyStr: string): Uint8Array {
  if (keyStr.startsWith("nsec")) {
    const decoded = nip19.decode(keyStr);
    if (decoded.type === "nsec") return decoded.data;
  }
  return Buffer.from(keyStr, "hex");
}

async function publishNostrEvent(
  eventData: { kind: number; content: string; tags: string[][] },
  privateKeyBytes: Uint8Array
): Promise<string> {
  const event = finalizeEvent(
    { kind: eventData.kind, created_at: Math.floor(Date.now() / 1000), tags: eventData.tags, content: eventData.content },
    privateKeyBytes
  );
  for (const url of relays) {
    try {
      const relay = await Relay.connect(url);
      await relay.publish(event);
      printOk(`Published Nostr event ${event.id.substring(0, 12)}… to ${url}`);
      relay.close();
    } catch (err: any) {
      printFail(`Nostr relay ${url} rejected the event.`, err?.message || String(err));
    }
  }
  return event.id;
}

// ─── Federation (ActivityPub + social adapters) ────────────────────────────────
async function federateNewsletter(newsletterId: number, title: string, contentMd: string) {
  const host = new URL(API_BASE).host;
  const actorId = `https://${host}/api/entities/almanac/actor`;

  // 1. ActivityPub outbound
  try {
    const followersRes = await pool.query<{ follower_actor_uri: string }>(
      `SELECT DISTINCT follower_actor_uri FROM entity_followers WHERE entity_slug IN ('almanac', 'sailsouthern')`
    );
    const followers = followersRes.rows;
    if (followers.length === 0) {
      printWarn("No ActivityPub followers found — skipping federation.");
    } else {
      printOk(`Enqueuing ActivityPub note for ${followers.length} follower${followers.length === 1 ? "" : "s"}…`);
      const redisConnection = { host: process.env.REDIS_HOST || "localhost", port: parseInt(process.env.REDIS_PORT || "6379", 10) };
      const apOutboundQueue = new Queue("activitypub-outbound", { connection: redisConnection });
      const snippetHtml = `<strong>🗞️ ${title}</strong><br/><br/>${contentMd.slice(0, 450).replace(/\n/g, "<br/>")}...<br/><br/><a href="${API_BASE}/newsletter/latest">Read the full edition online.</a>`;
      for (const row of followers) {
        const noteActivity = {
          "@context": ["https://www.w3.org/ns/activitystreams", "https://w3id.org/security/v1"],
          id: `https://${host}/api/activities/${crypto.randomUUID()}`,
          type: "Create",
          actor: actorId,
          to: ["https://www.w3.org/ns/activitystreams#Public"],
          object: {
            id: `https://${host}/api/newsletters/${newsletterId}`,
            type: "Note",
            published: new Date().toISOString(),
            attributedTo: actorId,
            content: snippetHtml,
            to: ["https://www.w3.org/ns/activitystreams#Public"],
          },
        };
        await apOutboundQueue.add("deliver", { actorId, inboxUrl: row.follower_actor_uri, activity: noteActivity });
      }
      await apOutboundQueue.close();
      printOk("All ActivityPub delivery jobs queued.");
    }
  } catch (err: any) {
    printFail("ActivityPub federation queue failed.", err?.message || String(err));
    printFixHint("Check REDIS_HOST/REDIS_PORT in .env and that Redis is reachable.");
  }

  // 2. Social platform adapters
  let mastodonAccountId = 1, nostrAccountId = 2, blueskyAccountId = 3;
  try {
    const accs = await pool.query<{ id: number; platform: string }>(
      `SELECT id, platform FROM social_accounts WHERE is_active = true`
    );
    for (const r of accs.rows) {
      if (r.platform === "mastodon") mastodonAccountId = r.id;
      if (r.platform === "nostr")   nostrAccountId = r.id;
      if (r.platform === "bluesky") blueskyAccountId = r.id;
    }
  } catch (dbErr: any) {
    printFail("Could not load social_accounts from DB.", "Check DATABASE_URL in .env.");
  }

  const canonicalContent = { id: newsletterId, type: "newsletter" as const, title, text: contentMd };
  const queryRunner = (sql: string, params?: any[]) => pool.query(sql, params);

  try {
    const res = await publishToMastodon(queryRunner, mastodonAccountId, canonicalContent);
    printOk(`Published to Mastodon. Post ID: ${res.postId}`);
  } catch (err: any) {
    printFail(`Mastodon post did not publish: ${err.message}`, "Check MASTODON_INSTANCE_URL and MASTODON_ACCESS_TOKEN in .env.");
  }

  try {
    const res = await publishToNostr(queryRunner, nostrAccountId, canonicalContent);
    printOk(`Published to Nostr. Post ID: ${res.postId}`);
  } catch (err: any) {
    printFail(`Nostr post did not publish: ${err.message}`, "Check NOSTR_PRIVATE_KEY in .env and that the relay is reachable.");
  }

  try {
    const res = await publishToBluesky(queryRunner, blueskyAccountId, canonicalContent);
    printOk(`Published to Bluesky. Post ID: ${res.postId}`);
  } catch (err: any) {
    printFail(`Bluesky post did not publish: ${err.message}`, "Check BLUESKY_IDENTIFIER and BLUESKY_PASSWORD in .env.");
  }
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function buildRedirectUrl(urlHash: string, articleTitle: string): string {
  const slug = slugify(articleTitle);
  return `${API_BASE}/r/${urlHash.slice(0, 8)}?src=nl&utm_source=sailsouthern&utm_medium=email&utm_campaign=${titleDate}&utm_content=${slug}`;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_ADDRESS = "Sailing Almanac <hello@sailsouthern.com>";

async function generateAndBroadcastDaily() {
  printSection(
    `Daily newsletter — ${titleDate}${isRetroactive ? " (retroactive)" : ""}`,
    isDryRun ? "DRY RUN" : "LIVE"
  );
  console.log(`  Started at: ${new Date().toLocaleString()}`);
  if (isDryRun) printWarn("Dry run mode — content will be generated and logged, but nothing will be saved or sent.");
  if (isRetroactive) printWarn("Retroactive date — email broadcast to subscribers will be skipped.");

  // ── Section 1: Config check ──────────────────────────────────────────────
  printSection("Configuration check");
  const configOk = {
    gemini:  !!process.env.GEMINI_API_KEY,
    resend:  !!process.env.RESEND_API_KEY,
    db:      !!process.env.DATABASE_URL,
    ga4:     !!(process.env.GA4_MEASUREMENT_ID && process.env.GA4_API_SECRET),
  };
  if (configOk.gemini)  printOk("Gemini API key present — AI generation available");
  else                  printFail("GEMINI_API_KEY is missing.", "AI generation will fail. Add to .env from Google AI Studio.");
  if (configOk.resend)  printOk("Resend API key present — email delivery available");
  else                  printFail("RESEND_API_KEY is missing.", "Email broadcast will fail. Add from resend.com → API Keys.");
  if (configOk.db)      printOk("DATABASE_URL present");
  else                  printFail("DATABASE_URL is missing.", "All DB operations will fail.");
  if (configOk.ga4)     printOk("GA4 credentials present — server-side events enabled");
  else                  printWarn("GA4_MEASUREMENT_ID or GA4_API_SECRET missing — analytics events will be skipped.");

  if (!configOk.gemini || !configOk.db) {
    printFail("Required credentials missing. Cannot continue.", "Fix the issues above and re-run.");
    await closePool();
    process.exit(1);
  }

  // ── Section 2: Canonical Web Edition Check ───────────────────────────────
  printSection("Retrieving canonical web edition");
  const dateStr = targetDate.toISOString().split("T")[0];
  let editionId: number;
  let editionLabel = "";
  let markdownContent = "";
  let articlesCount = 0;

  try {
    const edRes = await pool.query<{ id: number; edition_label: string }>(
      `SELECT id, edition_label
       FROM newsletter_editions
       WHERE edition_date = $1::date AND edition_type = 'daily'
       LIMIT 1`,
      [dateStr]
    );

    if (edRes.rows.length === 0) {
      printWarn(`No compiled web edition found for ${dateStr}. Running automatic compile...`);
      // Trigger compile-edition.ts automatically if missing
      const compilePath = path.resolve("scripts/compile-edition.ts");
      execSync(`npx tsx "${compilePath}" --type daily --date ${dateStr}`);
      
      // Retry fetch
      const retryRes = await pool.query<{ id: number; edition_label: string }>(
        `SELECT id, edition_label
         FROM newsletter_editions
         WHERE edition_date = $1::date AND edition_type = 'daily'
         LIMIT 1`,
        [dateStr]
      );
      if (retryRes.rows.length === 0) {
        throw new Error(`Failed to compile or retrieve daily edition for ${dateStr}`);
      }
      editionId = retryRes.rows[0].id;
      editionLabel = retryRes.rows[0].edition_label;
    } else {
      editionId = edRes.rows[0].id;
      editionLabel = edRes.rows[0].edition_label;
    }
    printOk(`Found compiled web edition ${editionLabel} (ID: ${editionId})`);
  } catch (err: any) {
    printFail("Failed to retrieve or compile the daily edition.", err.message || String(err));
    await closePool();
    process.exit(1);
  }

  // ── Section 3: Render slots to Markdown ──────────────────────────────────
  printSection("Rendering slots to Markdown");
  try {
    const slotsRes = await pool.query(
      `SELECT ns.article_id, al.title, al.canonical_url, al.redirect_hash,
              al.og_image_url, al.content_snippet, al.publisher_name, al.published_at,
              ns.section, ns.section_display_name, ns.slot_position
       FROM newsletter_slots ns
       JOIN article_links al ON al.id = ns.article_id
       WHERE ns.edition_id = $1 AND ns.is_active = TRUE
       ORDER BY
         CASE ns.section WHEN 'front-page' THEN 0 ELSE 1 END,
         ns.section,
         ns.slot_position ASC`,
      [editionId]
    );

    const rows = slotsRes.rows;
    if (rows.length === 0) {
      throw new Error(`No active slots found for edition ID ${editionId}`);
    }
    articlesCount = rows.length;

    // Group by section
    const sections = new Map<string, { displayName: string; slots: any[] }>();
    for (const row of rows) {
      const key = row.section;
      if (!sections.has(key)) {
        sections.set(key, {
          displayName: row.section_display_name || key.toUpperCase(),
          slots: [],
        });
      }
      sections.get(key)!.slots.push(row);
    }

    const escMd = (s: string) => s.replace(/([[\]()\\`*_{}#.!|>])/g, "\\$1");
    const lines: string[] = [];

    for (const [sectionSlug, { displayName, slots }] of sections) {
      lines.push(`## ${displayName}`);
      lines.push("");

      for (const slot of slots) {
        const hash = slot.redirect_hash;
        const articleUrl = hash
          ? `${API_BASE}/sendit/${hash}?src=nl&utm_medium=email&utm_campaign=${titleDate}`
          : slot.canonical_url;

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
      }
      lines.push(`[More: ${displayName} →](${API_BASE}/sections/${sectionSlug})`);
      lines.push("");
      lines.push("---");
      lines.push("");
    }

    markdownContent = lines.join("\n");
    printOk(`Rendered ${rows.length} slots successfully (${markdownContent.length} chars)`);
  } catch (err: any) {
    printFail("Failed to render edition slots to Markdown.", err.message || String(err));
    await closePool();
    process.exit(1);
  }

  const newsletterTitle = `Sailing Almanac Daily Digest: ${titleDate}`;

  if (isDryRun) {
    // ── Dry run preview ───────────────────────────────────────────────────
    printSection("Content preview (dry run)");
    console.log(`  Title: ${newsletterTitle}`);
    console.log(`  Content length: ${markdownContent.length} chars`);
    console.log(`\n  First 500 characters:\n`);
    console.log(markdownContent.substring(0, 500));
    console.log("  …");
    printSection("Dry run complete — nothing saved or sent");
    printOk("Content generated successfully.");
    printWarn("Re-run without --dry-run to save to DB and broadcast to subscribers.");
    await closePool();
    return;
  }

  // ── Section 4: Save and federate ─────────────────────────────────────────
  printSection("Saving and federating");
  let newsletterId: number;
  try {
    const insertRes = await pool.query<{ id: number }>(
      `INSERT INTO newsletters (title, content_md, status, created_at) VALUES ($1, $2, 'published', $3) RETURNING id`,
      [newsletterTitle, markdownContent, targetDate]
    );
    newsletterId = insertRes.rows[0].id;
    printOk(`Newsletter saved to database (ID: ${newsletterId})`);
  } catch (err: any) {
    printFail("Failed to save newsletter to database.", "Check DATABASE_URL and that the newsletters table exists.");
    console.error(err);
    await closePool();
    process.exit(1);
  }

  await sendGA4Event("newsletter_publish_started", { target_date: titleDate });
  await broadcastAlert({ title: "🗞️ Morning Newsletter Generation Initiated", text: `Starting compilation of today's Daily Digest edition…`, color: "3498DB" });

  printSection("Social platform delivery");
  await federateNewsletter(newsletterId, newsletterTitle, markdownContent);

  if (isRetroactive) {
    printWarn("Retroactive edition — skipping email broadcast to subscribers.");
    await broadcastAlert({ title: "🗞️ Retroactive Newsletter Published", text: `Saved edition "${newsletterTitle}" (ID: ${newsletterId}). Email broadcast skipped.`, color: "3498DB" });
    printSummary({ "Newsletter ID": newsletterId, "Articles": articlesCount, "Email broadcast": "skipped (retroactive)" });
    await closePool();
    return;
  }

  // ── Section 5: Email broadcast ────────────────────────────────────────────
  printSection("Email broadcast");
  let emails: string[] = [];
  try {
    const subRes = await pool.query<{ email: string }>(
      "SELECT email FROM subscribers WHERE status = 'active' AND personalized = false"
    );
    emails = subRes.rows.map((r) => r.email);
  } catch (err: any) {
    printFail("Could not fetch active subscribers.", "Check DATABASE_URL and that the subscribers table exists.");
    console.error(err);
  }

  if (emails.length === 0) {
    printWarn("No active subscribers found — newsletter saved but not broadcast.");
    await broadcastAlert({ title: "🗞️ Morning Newsletter Published (No Subscribers)", text: `Generated "${newsletterTitle}" (ID: ${newsletterId}), 0 active subscribers.`, color: "FFBF00" });
  } else {
    printOk(`Broadcasting to ${emails.length} subscriber${emails.length === 1 ? "" : "s"}…`);
    const batchSize = 100;
    let sentCount = 0;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      try {
        await resend.batch.send(
          batch.map((to) => ({
            from: FROM_ADDRESS,
            to,
            subject: newsletterTitle,
            html: `<pre style="font-family:sans-serif;white-space:pre-wrap;max-width:680px;">${markdownContent}</pre>`,
          }))
        );
        sentCount += batch.length;
      } catch (err: any) {
        printFail(`Resend batch ${i / batchSize + 1} failed.`, "Check RESEND_API_KEY and that the from address is verified.");
        console.error(err);
      }
    }
    printOk(`Email broadcast complete — sent to ${sentCount} of ${emails.length} subscribers`);

    await sendGA4Event("newsletter_publish_completed", { status: "success", title: newsletterTitle, subscribers_sent: sentCount, articles_count: articlesCount, newsletter_id: newsletterId });
    await broadcastAlert({
      title: "🗞️ Morning Newsletter Broadcast Complete! 🚀",
      text: `Successfully generated and sent today's edition.`,
      fields: [
        { name: "Newsletter Title", value: newsletterTitle, inline: false },
        { name: "Subscribers Emailed", value: `${sentCount}`, inline: true },
        { name: "Articles Compiled", value: `${articlesCount}`, inline: true },
        { name: "Database Record", value: `ID: ${newsletterId}`, inline: true },
      ],
      color: "39FF14",
    });

    // ── Summary ───────────────────────────────────────────────────────────
    printSection("Run complete");
    printSummary({ "Newsletter ID": newsletterId, "Articles": articlesCount, "Subscribers": sentCount, "Mode": "LIVE" });
  }

  await closePool();
}

generateAndBroadcastDaily().catch(async (err: any) => {
  printFail(`Daily newsletter run failed unexpectedly: ${err.message || String(err)}`, "Review the stack trace below.");
  console.error(err);
  await sendGA4Event("newsletter_publish_completed", { status: "failed", error_message: err.message || String(err) });
  await broadcastAlert({ title: "🚨 Morning Newsletter Failure", text: `Failed:\n\`\`\`\n${err.message || err}\n\`\`\``, color: "FF5F1F" });
  await closePool().catch(() => {});
  process.exit(1);
});
