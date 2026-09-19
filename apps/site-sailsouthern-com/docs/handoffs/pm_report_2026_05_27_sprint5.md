# Project Manager Report — Sailing Almanac / Sail Southern
**Date:** 2026-05-27  
**Status:** Sprints 1–4 Complete. Sprint 5 Initiating.  
**Repo:** `c:\Users\aewoo\.projects\repos\ss-sailsouthern-com`  
**Production Host:** `chantecler-01` (DigitalOcean droplet, SSH alias `chantecler-01`)

---

## 1. Architecture Summary

This is a **monorepo** with the following workspace structure:

```
/apps/web/              ← Next.js 16 frontend
/apps/api/              ← Express 4 REST API (port 4000)
/workers/ingest/        ← Node/BullMQ ingestion workers (compiled, not yet daemonized)
/infra/docker/          ← docker-compose for PostgreSQL, Redis, Meilisearch
/infra/db/migrations/   ← Raw SQL migrations
/data/                  ← languages.csv (52 languages for multi-lingual crawl)
/docs/                  ← Architecture docs, handoffs, next-batch notes
```

The long-term product is an **IMDb-for-sailing** entity graph with a custom public frontend. The backend is a structured graph/content system with crawl orchestration and tagging. The newsletter and front-page layers ride on top of this backend.

---

## 2. Credentials Inventory

All credentials are stored in `.env` (gitignored). Template is documented in `.env.example`.

| Service | Variable | Status |
|---|---|---|
| PostgreSQL | `DATABASE_URL` | ✅ Connected on chantecler-01 |
| Redis | `REDIS_URL` | ✅ Connected on chantecler-01 |
| Meilisearch | `MEILI_HTTP_ADDR` + `MEILI_MASTER_KEY` | ✅ Connected on chantecler-01 |
| Backblaze B2 | `B2_KEY_ID`, `B2_APPLICATION_KEY` | ✅ Keys stored, bucket name TBD |
| Gemini API | `GEMINI_API_KEY` | ✅ `${GEMINI_API_KEY}` (project: `sailsouthern-db-transcript`, proj# 899030401242) |
| Resend (Email) | `RESEND_API_KEY` | ✅ `${RESEND_API_KEY}` |

---

## 3. Remote Infrastructure (chantecler-01)

Three Docker containers are running in production:

| Container | Image | Role |
|---|---|---|
| `almanac-db` | PostgreSQL 16 | Primary data store |
| `almanac-redis` | Redis 7 | BullMQ job queues |
| `almanac-search` | Meilisearch v1.6 | Full-text search indexing |

**Database Tables (fully migrated):**
- `languages` (52 rows seeded)
- `source_families`, `sources`, `feed_endpoints`
- `article_links` (with `metadata JSONB`, `user_flags JSONB`)
- `sailors`, `boats`, `regattas`, `participation`, `race_results`, `families`, `sailor_alias` (aligned to sibling `sailing-records` SQLite schema)
- `entity_mentions` (links articles to entity records)
- `newsletters` (stores Gemini-generated daily/weekly editions)

---

## 4. Completed Sprints

### Sprint 1–2: Architecture + Infrastructure
- Monorepo restructured with npm workspaces.
- Docker Compose deployed to `chantecler-01`.
- All DB migrations applied remotely.
- Express API skeleton with language CSV seeder.

### Sprint 3: Ingestion Pipeline
- `workers/ingest/src/feed-poller.ts` — reads `feed_endpoints`, parses RSS/Atom, detects podcasts via `<enclosure>` tags, routes to BullMQ queues.
- `workers/ingest/src/dedupe.ts` — strips UTM tracking, SHA-256 URL hashing, Gemini `text-embedding-004` semantic deduplication stubs.
- `workers/ingest/src/podcast-processor.ts` — BullMQ worker, checks for transcripts, calls Gemini 1.5 Flash to summarize audio content, saves to `metadata JSONB`.
- `apps/api/src/index.ts` — Added `POST /api/webhooks/inoreader` and `POST /api/articles/:id/flag` endpoints.

### Sprint 4: Archival Storage + Newsletter + Ticker
- `workers/ingest/src/b2-client.ts` — strips HTML via Cheerio, archives to Backblaze B2 (`archives/YYYY/MM/hash.html`).
- `workers/ingest/src/newsletter-generator.ts` — Gemini 1.5 Pro. Daily (72h lookback) and Weekly (240h lookback, Monday publication), duplicate-article guard, saves to `newsletters` table.
- `apps/api/src/index.ts` — Added `GET /api/ticker` (20 most recent articles by `created_at DESC`).
- `newsletters` table applied to production DB.

---

## 5. Product Vision & Full Roadmap

### Immediate (Sprint 5 — starting now)
- [ ] Next.js homepage: Live Ticker component, Gemini Newsletter display, Meilisearch search bar.
- [ ] Seed `feed_endpoints` table with initial RSS feeds.
- [ ] Deploy ingest worker as Docker container on `chantecler-01`.
- [ ] `apps/api/src/lib/mailer.ts` — Resend/react-email mailer skeleton.
- [ ] Advanced newsletter SQL: recency-weighted queries, dedup against recent newsletters.

### Short-Term
- **Social Media Scraping (Aggressive)**: RSS-Bridge, Nitter, Proxied scrapers. Screenshots → Gemini multimodal OCR → blockquote text (for SEO) + blurb (for newsletter) + B2 archive of screenshot → link-through to original post.
- **Podcast Radio Stations**: Custom embedded on-site audio player. Two curated streams — "Racing Radio" and "Cruising Radio" — continuously queued from discovered podcast feeds.
- **Customized Newsfeeds**: Gemini 1.5 Flash per-user newsletter generation via Resend Broadcasts. Node-based subscription (users pick content nodes). Launch with top-third most popular nodes.

### Medium-Term
- **Multi-Niche Framework**: Abstract entity graph and crawler for reuse in climbing, soaring, scouting, kites, etc. Sailing is the first deployment.
- **Federated Web (ActivityPub)**: Broadcast entity discoveries directly into the Fediverse.
- **Value-for-Value Micropayments**: Alby / Lightning Network SATs tipping for content creators.
- **Internet Archive Integration**: Auto-trigger Wayback Machine snapshots for all ingested URLs.

---

## 6. Open Items / Blockers

| Item | Owner | Notes |
|---|---|---|
| Inoreader webhook config | User | Sailing RSS feeds need to be grouped into an "Almanac" folder in Inoreader, then webhook pointed to `POST /api/webhooks/inoreader` |
| Backblaze B2 bucket name + region endpoint | User | `B2_BUCKET_NAME` and `B2_ENDPOINT` still need to be confirmed in `.env` |
| Initial RSS feed seed list | User | First batch of URLs to populate `feed_endpoints` table — hand to engineering when ready |
| Crawler daemonization on chantecler-01 | Engineering | Blocked on feed list above |
| Resend domain verification | User | Sending domain must be verified in Resend dashboard before production emails can go out |

---

## 7. Key Architectural Decisions (Locked)

- **Link-first ingestion, entity-first presentation.**
- **Dual BullMQ queues**: `live_ingest` and `archival_backfill` prevent archive crawls from starving live traffic.
- **Podcast = first-class citizen**: Dedicated player, radio stations, metadata, AI summary.
- **Social = screenshot → Gemini OCR → blockquote + blurb → B2 screenshot archive → link-through to original.**
- **Newsletter cadence**: Daily (72h window) every day + Weekly (240h, regatta-weighted). Both published on Mondays.
- **Personalization**: Gemini 1.5 Flash + Resend Broadcasts. Per-user node subscriptions.
- **Multi-niche from day one**: Every abstraction must be reusable for other verticals.
