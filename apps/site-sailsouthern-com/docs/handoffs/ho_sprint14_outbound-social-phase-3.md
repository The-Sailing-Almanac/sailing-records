# Outbound Social Archive Phase 3 Handoff Memo

**Date:** 2026-05-29  
**Operator:** Antigravity (AI Pair Programmer)  
**Role:** Planning / PM  
**Sprint:** `sailsouthern-outbound-social-phase-3`  

---

## 1. Live Platform Adapters

All three platform adapters are fully live and operational, configured to communicate with production network endpoints.

### Mastodon Adapter
- **Behavior on Success**: Posts the status update via standard HTTPS request to `/api/v1/statuses`. Captures the returned status ID and permalink, writes them to `social_post_deliveries` with `status = 'success'`, and logs the delivered timestamp.
- **Behavior on Failure**: If instance connection fails or returns non-2xx codes, catches the error and records it in `social_post_deliveries` with `status = 'failed'` and the error message payload, throwing the error upward to alert callers.

### Nostr Adapter
- **Behavior on Success**: Decodes `NOSTR_PRIVATE_KEY` (supporting both hex and NIP-19 `nsec` prefixes), constructs a Kind-1 note with hashtag tags, signs it using `finalizeEvent`, and broadcasts it to configured Nostr relays. Records `status = 'success'` in `social_post_deliveries` when at least one relay acknowledges the note.
- **Behavior on Failure**: Logs and throws errors if all relays fail to respond or accept the signed event, writing a detailed error log of failures per relay to the database delivery record.

### Bluesky/ATProto Adapter
- **Behavior on Success**: Uses `@atproto/api` to authenticate, resolve rich-text links and tags into facets automatically, upload attachments as blobs, and create the post record. Records the record URI, user DID, and post permalink, saving `status = 'success'` to the database.
- **Behavior on Failure**: Catches and records authentication errors or post failures as `failed` deliveries.

---

## 2. Capture Worker (Wayback/SPN)

- **Behavior**: Periodically queries successful social post deliveries that lack a corresponding `completed` entry in `social_post_captures` (under `capture_type = 'wayback_spn'`).
- **Scheduling**: The database scanner daemon triggers every **5 minutes** to look for unarchived entries, enqueuing a BullMQ task for each candidate.
- **External Dependencies**: Leverages the Internet Archive Wayback Machine Save Page Now (SPN) API endpoint (`https://web.archive.org/save/`). Bypasses basic rate limits using authenticated headers with `WAYBACK_ACCESS_KEY` and `WAYBACK_SECRET_KEY` variables.
- **Idempotency**: Utilizes deterministic job IDs (`wayback-spn-del-${deliveryId}`) in BullMQ to avoid parallel duplicate archival runs.

---

## 3. Metrics Worker

- **Schedule & Window**: Runs **every 1 hour**, scanning active deliveries published in the last **7 days**.
- **Supported Platforms**: Mastodon (`/api/v1/statuses/:id` status endpoint) and Bluesky (XRPC `app.bsky.feed.getPostThread?uri=...` post thread endpoint).
- **Rate-Limit & Performance Strategy**:
  - Implements an append-only time-series layout in `social_post_metrics_snapshots` rather than overwriting historical counts.
  - Limits database scans to recent posts (last 7 days) to bound API usage.
  - Throttles requests by introducing a **1-second delay** between individual API calls to avoid triggering external rate-limit throttling.

---

## 4. Admin Dashboard "Social" UI Tab

The admin panel under `apps/web/src/app/admin/page.tsx` was extended to consume the versioned `/api/v1/social/posts` route:
- **Delivery permalinks**: Clicking the platform logo takes the curator directly to the external post on Bluesky, Mastodon, or njump for Nostr.
- **Wayback Capture Badges**: Shows an archive status indicator for each delivery:
  - `Archived` (Green badge linking to the Wayback URL).
  - `Pending` (Yellow badge indicating capture is queued/in-progress).
  - `Failed` (Red badge showing errors occurred during SPN archive).
- **Real-Time Cumulative Metrics**: Displays cumulative counts for `❤️ Likes`, `🔁 Shares`, and `💬 Replies` alongside each post delivery, tracking audience engagement history.

---

## 5. Next Steps & Open Questions
- **Richer Analytics**: Introduce a cron script to aggregate weekly analytics (e.g. tracking engagement rate growth across rails).
- **Intake Automations**: Wire the `social_intake_sources` registry into a scheduled webhook puller that periodically queries Facebook feeds and feeds them into the Gemini processor.
- **Additional Platforms**: Add Twitter/X or Threads adapters using their respective API clients once the brand identity expands.
