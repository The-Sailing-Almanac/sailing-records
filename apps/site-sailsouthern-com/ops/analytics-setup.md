# GA4 Analytics Setup Guide
# Sail Southern / Sailing Almanac — Operator Reference
# Date: 2026-05-29

---

## Overview

Sail Southern uses **Google Analytics 4 Measurement Protocol** for server-side
event tracking. This means publish events, archive events, and newsletter sends
are tracked directly from the server — not from browser JavaScript tags.

This is intentional: server-side events are more reliable than client-side tags
and are not affected by ad blockers or privacy browsers.

When `GA4_MEASUREMENT_ID` and `GA4_API_SECRET` are set, the system sends events
automatically on every publish, archive write, and newsletter send.

---

## Step 1 — Create a GA4 Property

If you don't already have one:

1. Go to [analytics.google.com](https://analytics.google.com)
2. Click **Admin** (gear icon, bottom left)
3. Click **+ Create** → **Property**
4. Name: `Sail Southern` | Timezone: `Central Time (US)` | Currency: `USD`
5. Follow the setup wizard (choose "Web" platform)
6. Note your **Measurement ID** (format: `G-XXXXXXXXXX`) — you'll need it below

---

## Step 2 — Find Your Measurement ID

If the property already exists:

1. **Admin** → **Data Streams** (under Your Property)
2. Click your web stream
3. Copy the **Measurement ID** (top of the page, format `G-XXXXXXXXXX`)

```
GA4_MEASUREMENT_ID=G-XXXXXXXXXX
```

---

## Step 3 — Create a Measurement Protocol API Secret

This secret authorizes server-side events. It is separate from your Google credentials.

1. **Admin** → **Data Streams** → click your web stream
2. Scroll down to **Measurement Protocol API secrets**
3. Click **Create**
4. Give it a nickname: `ss-server-events`
5. Copy the generated **Secret value** (you won't be able to see it again)

```
GA4_API_SECRET=xxxxxxxxxxxxxxxxxxxx
```

> ⚠️ Store this in `.env` only. Never commit it to the repo.

---

## Step 4 — Find Your Property ID (for Data API)

The Property ID is used by the GA4 Data API for the analytics dashboard.
It is different from the Measurement ID.

1. **Admin** → under **Property column**, look for **Property Details**
2. Copy the **Property ID** (numeric, e.g. `123456789`)
3. Format it with the prefix:

```
GA4_PROPERTY_ID=properties/123456789
```

---

## Step 5 — Add to .env

Add these three lines to your `.env`:

```bash
# GA4 Analytics
GA4_MEASUREMENT_ID=G-XXXXXXXXXX    # From Data Streams
GA4_API_SECRET=xxxxxxxxxxxx         # From Measurement Protocol secrets
GA4_PROPERTY_ID=properties/XXXXXXX # From Property Settings (numeric ID)
```

Then restart the API server:

```powershell
# In the api directory:
npm run dev
# or restart the production process
```

---

## Step 6 — Verify in Readiness Dashboard

After adding the keys:

1. Open the admin dashboard
2. Go to the **Readiness** tab
3. Find **Analytics — server-side events**
4. Status should change from 🔴 Blocked → ✅ Ready

You can also call the readiness endpoint directly:
```
GET /api/v1/system/readiness
```
Look for `"name": "Analytics — server-side events"` in the response.

---

## Step 7 — Verify Events Are Sending

After a publish run, verify events arrived in GA4:

1. In GA4, go to **Reports** → **Realtime**
2. Look for events from your server (event names: `page_view`, `publish`, `newsletter_send`)
3. Events may take 24–48 hours to appear in standard reports but appear within seconds in Realtime

Alternatively, use GA4 DebugView:
1. **Admin** → **DebugView**
2. Trigger a dry-run or sample publish
3. Events sent with `debug_mode: true` appear here immediately

> Note: The current implementation does NOT set `debug_mode` by default.
> To enable it temporarily, set `GA4_DEBUG_MODE=true` in `.env` and restart.

---

## What Events Are Tracked

| Event | When sent | Parameters |
|-------|-----------|------------|
| `edition_compiled` | After `compile-edition.ts` completes | `edition_date`, `edition_type`, `slot_count` |
| `newsletter_sent` | After `generate-daily-newsletter.ts` sends | `recipient_count`, `edition_id` |
| `micro_edition_published` | After `generate-micro-edition.ts` | `platforms`, `run_id` |
| `archive_saved` | After Wayback SPN save | `url`, `result` |

Events from **sample runs** are suppressed — only live production runs send GA4 events.

---

## Graceful Degradation

The system skips GA4 silently when credentials are missing. No crashes, no errors in
operator output. You will see a log line like:

```
[GA4] Skipping event: GA4_MEASUREMENT_ID or GA4_API_SECRET not set.
```

This means: events are not being tracked, but the publish cycle continues normally.

---

## Privacy Note

GA4 Measurement Protocol events are server-to-server. No client-side JavaScript tag
is required. This means:
- Readers with ad blockers are still counted (server-side only)
- No third-party scripts are loaded in the browser from this implementation
- Client-side tracking (if any) is separate from server-side Measurement Protocol

If you want to add client-side GA4 tag tracking in the future, use the
`GA4_MEASUREMENT_ID` in the Next.js layout with Google's gtag.js script — but
this is NOT required for server-side event tracking to work.
