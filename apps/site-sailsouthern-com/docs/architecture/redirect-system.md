# Redirect System Architecture

## Overview

All outbound article links on Sail Southern use the `/sendit/<hash>` redirect endpoint.  
This is a **LINK DOCTRINE** — enforced at the code level, not just convention.

```
reader clicks → https://api.sailsouthern.com/sendit/3a7f91bc?src=nl&sid=42
                     ↓ (~10ms)
                look up redirect_links.hash
                     ↓
                fire-and-forget: insert redirect_clicks row
                fire-and-forget: UPDATE article_links SET click_count = click_count + 1
                     ↓
                HTTP 302 → canonical_url
```

## Hash Format

- **8-char base62** (`[0-9A-Za-z]`) derived deterministically from the article UUID
- Source: last 12 hex chars of the UUID → BigInt → base62 → padded to 8 chars
- Collision probability at 100k articles: ~0.03% (acceptable; ON CONFLICT DO NOTHING handles it)

## Database Tables

### `redirect_links`
Canonical lookup: hash → canonical URL. One row per article.

```sql
CREATE TABLE redirect_links (
  id              SERIAL PRIMARY KEY,
  hash            TEXT UNIQUE NOT NULL,
  article_link_id UUID REFERENCES article_links(id) ON DELETE SET NULL,
  canonical_url   TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### `redirect_clicks`
Analytics log. Never blocks a redirect (fire-and-forget).

```sql
CREATE TABLE redirect_clicks (
  id              SERIAL PRIMARY KEY,
  article_link_id UUID,
  redirect_hash   TEXT NOT NULL,
  subscriber_id   INT,           -- NULL = anonymous
  source          TEXT,          -- 'web','newsletter','email_daily','email_weekly','rss'
  utm_medium      TEXT,
  referrer        TEXT,
  ip_hash         TEXT,          -- SHA-256(req.ip) — never raw
  clicked_at      TIMESTAMPTZ DEFAULT NOW()
);
```

## Source Attribution

Append `?src=` to any `/sendit/` link:

| `?src=` value | Source label |
|---|---|
| _(none)_ | `web` |
| `nl` | `newsletter` |
| `ed` | `email_daily` |
| `ew` | `email_weekly` |
| `rss` | `rss` |

Optional: `?sid=<subscriber_id>` and `?utm_medium=<value>`

## Rate Limiting

- **Nginx level**: 120 req/min/IP (`sendit_zone`) with burst=20
- **Application level**: 20 req/min/IP (in-memory sliding window, defense-in-depth)

Both return HTTP 429 on violation.

## OG Images

**NOT redirected.** OG image URLs from `article_links.og_image_url` are served directly from the source. The site displays them at source URLs — no proxying, no hotlinking concern at the display layer.

## Scripts

```bash
# Generate hashes for all existing articles
npm run generate-redirect-hashes

# Generate hashes with custom batch size
npm run generate-redirect-hashes -- --batch=10000
```

## Ingest Pipeline

New articles get a redirect hash automatically:  
`workers/ingest/src/feed-poller.ts` → RETURNING id → `apps/api/src/lib/redirect.ts:ensureRedirectLink()`

## Files

| File | Purpose |
|---|---|
| `apps/api/src/lib/redirect.ts` | Hash builder, resolver, click logger |
| `apps/api/src/index.ts` | `GET /sendit/:hash` route |
| `scripts/generate-redirect-hashes.ts` | Backfill all existing articles |
| `infra/db/migrations/008_redirect_system.sql` | DB schema |
