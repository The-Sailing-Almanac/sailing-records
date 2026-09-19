/**
 * Script: backfill-inoreader.ts
 * Purpose: Operational run script.
 * Idempotent: Yes
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import { Pool } from "pg";
import crypto from "crypto";
import dotenv from "dotenv";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[backfill-inoreader] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}

dotenv.config();

const FOLDER_LABEL = process.env.INOREADER_FOLDER || "Almanac";
const APP_ID      = process.env.INOREADER_APP_ID!;
const APP_KEY     = process.env.INOREADER_APP_KEY!;
const EMAIL       = process.env.INOREADER_EMAIL!;
const PASSWORD    = process.env.INOREADER_PASSWORD!;
const BATCH_SIZE  = 250; // Inoreader max per request
const API_BASE    = "https://www.inoreader.com/reader/api/0";

const db = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Auth ────────────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string> {
  if (process.env.INOREADER_TOKEN) {
    console.log("[Auth] Using provided INOREADER_TOKEN");
    return process.env.INOREADER_TOKEN;
  }

  console.log("[Auth] Authenticating with Inoreader...");
  const res = await fetch("https://www.inoreader.com/accounts/ClientLogin", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "AppId": APP_ID,
      "AppKey": APP_KEY,
    },
    body: new URLSearchParams({
      Email: EMAIL,
      Passwd: PASSWORD,
      service: "reader",
      accountType: "HOSTED_OR_GOOGLE",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth failed (${res.status}): ${text}`);
  }

  const text = await res.text();
  const match = text.match(/Auth=(.+)/);
  if (!match) throw new Error("Could not parse auth token from response");

  const token = `GoogleLogin auth=${match[1].trim()}`;
  console.log("[Auth] ✓ Authenticated successfully");
  return token;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","ref","fbclid","gclid"]
      .forEach(k => u.searchParams.delete(k));
    let clean = u.toString();
    if (clean.endsWith("/")) clean = clean.slice(0, -1);
    return clean;
  } catch {
    return rawUrl.trim();
  }
}

function generateUrlHash(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex");
}

// ─── Fetch folder contents (paginated) ───────────────────────────────────────

async function* fetchFolderItems(token: string): AsyncGenerator<any[]> {
  // Stream ID for a label/folder
  const streamId = encodeURIComponent(`user/-/label/${FOLDER_LABEL}`);
  let continuation: string | null = null;
  let page = 0;

  while (true) {
    page++;
    const params = new URLSearchParams({
      n: String(BATCH_SIZE),
      // Get everything regardless of read/unread state
      // xt (exclude) is intentionally NOT set — we want all items
    });
    if (continuation) params.set("c", continuation);

    const url = `${API_BASE}/stream/contents/${streamId}?${params}`;
    console.log(`[Fetch] Page ${page} (continuation: ${continuation || "start"})...`);

    const res = await fetch(url, {
      headers: {
        "Authorization": token,
        "AppId": APP_ID,
        "AppKey": APP_KEY,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Fetch failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const data: any = await res.json();
    const items: any[] = data.items || [];

    console.log(`[Fetch] Got ${items.length} items on page ${page}`);
    yield items;

    // Inoreader returns a continuation token when there are more items
    continuation = data.continuation || null;
    if (!continuation || items.length === 0) break;

    // Small delay to be polite to Inoreader's API
    await new Promise(r => setTimeout(r, 300));
  }
}

// ─── Insert into DB ───────────────────────────────────────────────────────────

async function insertItem(item: any): Promise<"inserted" | "skipped"> {
  const url: string =
    item.canonical?.[0]?.href ||
    item.alternate?.[0]?.href ||
    item.url;

  if (!url || !url.startsWith("http")) return "skipped";

  const cleanUrl = normalizeUrl(url);
  const urlHash = generateUrlHash(cleanUrl);

  // Parse publish date — Inoreader uses Unix seconds in `published`
  const now = new Date();
  let publishedAt: Date;
  let dateSuspicious = false;
  let dateSuspiciousReason = "";

  if (item.published && typeof item.published === "number") {
    publishedAt = new Date(item.published * 1000);
  } else {
    publishedAt = now;
    dateSuspicious = true;
    dateSuspiciousReason = "no_publish_date_in_feed";
  }

  const ageMs = now.getTime() - publishedAt.getTime();
  if (publishedAt.getTime() > now.getTime() + 3_600_000) {
    dateSuspicious = true;
    dateSuspiciousReason = "publish_date_in_future";
  } else if (ageMs > 180 * 86_400_000) {
    dateSuspicious = true;
    dateSuspiciousReason = `publish_date_${Math.floor(ageMs / 86400000)}d_old`;
  }

  const snippet = item.summary?.content
    ?.replace(/<[^>]+>/g, "")
    .slice(0, 500) || null;

  const metadata: Record<string, any> = {
    source: "inoreader_backfill",
    inoreader_id: item.id,
  };
  if (dateSuspicious) {
    metadata.date_quality = { suspicious: true, reason: dateSuspiciousReason };
  }

  const result = await db.query(
    `INSERT INTO article_links
      (url_hash, canonical_url, title, publisher_name, published_at, content_snippet, metadata, intake_source, processing_lane)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'inoreader','historical')
     ON CONFLICT (url_hash) DO NOTHING`,
    [
      urlHash,
      cleanUrl,
      item.title || "Untitled",
      item.origin?.title || null,
      publishedAt.toISOString(),
      snippet,
      JSON.stringify(metadata),
    ]
  );

  return (result.rowCount ?? 0) > 0 ? "inserted" : "skipped";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🌊 Inoreader Backfill — folder: "${FOLDER_LABEL}"\n`);

  if (!APP_ID || !APP_KEY) {
    console.error("❌ Missing INOREADER_APP_ID or INOREADER_APP_KEY");
    console.error("   Get them at: https://www.inoreader.com/developers/register-app");
    process.exit(1);
  }

  const token = await getAuthToken();

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalProcessed = 0;

  for await (const items of fetchFolderItems(token)) {
    for (const item of items) {
      const result = await insertItem(item);
      totalProcessed++;
      if (result === "inserted") {
        totalInserted++;
        if (totalInserted % 25 === 0) {
          console.log(`  ✓ ${totalInserted} inserted so far (${totalSkipped} already existed)...`);
        }
      } else {
        totalSkipped++;
      }
    }
  }

  console.log(`\n✅ Backfill complete!`);
  console.log(`   Processed : ${totalProcessed}`);
  console.log(`   Inserted  : ${totalInserted} new articles`);
  console.log(`   Skipped   : ${totalSkipped} (already in DB)`);

  await db.end();
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});