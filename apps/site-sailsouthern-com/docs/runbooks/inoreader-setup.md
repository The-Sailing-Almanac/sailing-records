# Inoreader Setup Runbook

## Overview
Inoreader is the primary human-curated signal layer for the Sailing Almanac ingestion pipeline.
It handles three distinct content types:
- **RSS/Atom feeds** from sailing news sites, blogs, and podcasts
- **Facebook Pages** (Inoreader Pro) — public pages for clubs, fleets, and events
- **Bluesky accounts/hashtags** (Inoreader Pro, native since Feb 2025)

All three flow through the same webhook endpoint. Our pipeline auto-detects the source type.

---

## ⚠️ Critical: Read/Unread State is IGNORED

**Our webhook ignores `read`, `unread`, and all engagement state from Inoreader.**

You may scroll through your Almanac folder and mark things read while curating — that will
NOT suppress ingestion. Articles are ingested based solely on their **publish date**.

To explicitly reject an article, apply the Inoreader tag `skip` (see Step 2 below).

---

## Step 1 — Create the "Almanac" Folder

1. Open Inoreader → Manage Feeds
2. Create folder: **"Almanac"**
3. Move all sailing-related feeds, Facebook Pages, and Bluesky accounts into this folder

---

## Step 2 — Tag-Based Filtering (Exclude Irrelevant Items)

Create an Inoreader Rule:
- **Trigger:** Article arrives in folder "Almanac"
- **Condition:** Tag is NOT "skip"
- **Action:** Fire Webhook → POST to `https://api.sailsouthern.com/api/webhooks/inoreader`

Tag any article "skip" to block it from ingestion. Read state is irrelevant.

---

## Step 3 — Adding Facebook Pages (Inoreader Pro Required)

Facebook Pages are where most US yacht clubs, fleets, and sailing events post primarily.

**To add a Facebook Page:**
1. Find the public Facebook Page URL (e.g., `https://www.facebook.com/USASailing`)
2. In Inoreader, click the **Add Feed (+)** button
3. Paste the Facebook Page URL directly into the search bar
4. On first use, Inoreader will ask you to connect your Facebook account — authenticate once
5. Drag the new feed into your **"Almanac"** folder

**Recommended pages to add (starter list):**
```
# US Sailing
https://www.facebook.com/USASailing

# World Sailing
https://www.facebook.com/WorldSailing

# SailGP
https://www.facebook.com/SailGP

# America's Cup
https://www.facebook.com/AmericasCup

# Sailing Anarchy
https://www.facebook.com/sailinganarchy

# Add yacht club and fleet pages specific to your coverage area below:
# https://www.facebook.com/[YOUR_CLUB]
```

**Important caveats:**
- Facebook's API limits mean some posts may have degraded images or no images
- Video content may not be accessible — this is by Facebook's design
- Our pipeline treats these as `source_type: "social_facebook"` and will use Gemini to extract
  the text content and generate a display blurb (as discussed in the screenshot/OCR plan)

---

## Step 4 — Adding Bluesky Accounts & Hashtags (Inoreader Pro)

Bluesky launched native Inoreader integration in February 2025. It supports:
- Individual accounts (`@handle.bsky.social`)
- Hashtags (e.g., `#sailing`, `#sailgp`, `#regatta`)
- Search results by keyword
- Your personal home timeline

**Setup steps:**
1. Generate a Bluesky App Password: Bluesky Settings → App Passwords → Add App Password
2. In Inoreader: Preferences → Share, save, login → Connect Bluesky
3. Enter your Bluesky handle and the app password
4. Click **Add Feed (+)** → Bluesky section → search for accounts or hashtags
5. Add these to your **"Almanac"** folder

**Recommended Bluesky follows (starter):**
```
# Search by keyword in Inoreader Bluesky integration:
#sailing
#sailgp
#regatta
#bluewater
#yachtracing

# Individual accounts to find and follow:
@worldsailing.bsky.social     (if active)
@sailinganarchy.bsky.social   (check — SA is very active)
# Search for any sailor or club handles you know
```

**Native Bluesky RSS (no Inoreader account needed for basic):**
Any public Bluesky profile also has a native RSS feed:
```
https://bsky.app/profile/{handle}/rss
# Example: https://bsky.app/profile/sailinganarchy.bsky.social/rss
```
You can add these native RSS URLs directly to Inoreader's feed list even on a free plan.
The full Inoreader integration (hashtags, keyword search, timeline) requires Pro.

---

## Step 5 — YouTube Channels (Free, Native RSS)

YouTube channels expose a native RSS feed — no scraping needed:
```
https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID_HERE
```

To find a channel ID: open the channel page → right-click → view source → search for `channelId`.

**Recommended channels:**
```
# OceanFilms / Sailing footage
# Find channel IDs for: VanderseeTV, Delos Sailing, Gone with the Wynns, etc.
```

---

## How Social Posts Are Handled Differently

When our webhook receives an item, it checks the `origin` field to detect the platform:

| Platform | Detection | Storage |
|---|---|---|
| Facebook Page | `origin.htmlUrl` contains `facebook.com` | `metadata.source_type = "social_facebook"` |
| Bluesky | `origin.htmlUrl` contains `bsky.app` | `metadata.source_type = "social_bluesky"` |
| YouTube | `enclosure` with `video/` MIME type | `metadata.source_type = "social_youtube"` |
| RSS Article | Everything else | `metadata.source_type = "rss_article"` |

Social posts will be queued for **Gemini multimodal processing** where we:
1. Extract the full text as a blockquote (for SEO)
2. Generate a short blurb (for newsletter display)
3. Archive the post content in B2
4. Link back to the original post

---

## Publish Date Handling

Our pipeline flags (but never rejects) articles with suspicious publish dates:

| Condition | Flag | Action |
|---|---|---|
| Date more than 1 hour in the **future** | `publish_date_in_future` | Ingested, de-ranked in newsletters |
| Date more than **180 days** in the past | `publish_date_Xd_old` | Ingested, de-ranked in newsletters |
| No date in feed | `no_publish_date_in_feed` | Uses ingestion time, flagged |

For Facebook/Bluesky posts, publish dates are generally reliable. The 180-day flag is most
relevant for archival RSS feeds or sites with unreliable CMS timestamps.

---

## Step 6 — Verify the Connection

```bash
# Watch API logs in real time
ssh chantecler-01 "docker logs almanac-api --tail 50 -f"

# Or query the DB directly
ssh chantecler-01 "docker exec almanac-db psql -U almanac_user -d almanac_db \
  -c \"SELECT title, publisher_name, metadata->>'source_type' as type, published_at \
       FROM article_links ORDER BY created_at DESC LIMIT 10;\""
```

Expected output when Inoreader webhook fires:
```
[Inoreader Webhook] Ingested: "Team NZ Takes the Lead" published=2026-05-27T18:00:00Z
[Inoreader Webhook] Ingested: "Facebook post from USASailing" published=... ⚠️ social_facebook
```

---

## Expected Inoreader Webhook Payload Shape

```json
{
  "id": "tag:google.com,2005:reader/item/XXXXXXXXXX",
  "title": "America's Cup: Team NZ Takes the Lead",
  "published": 1716847200,
  "canonical": [{ "href": "https://www.sailinganarchy.com/2026/05/27/americas-cup/" }],
  "origin": {
    "title": "Sailing Anarchy",
    "htmlUrl": "https://www.sailinganarchy.com"
  },
  "summary": { "content": "<p>Team New Zealand extended their lead...</p>" }
}
```

**Fields used:** `canonical[0].href`, `title`, `published` (Unix seconds), `origin.title`, `summary.content`  
**Fields ignored:** `read`, `unread`, `liker_count`, Inoreader internal categories
