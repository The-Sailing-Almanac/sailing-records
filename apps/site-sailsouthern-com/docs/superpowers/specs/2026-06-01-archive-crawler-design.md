# Archive Crawler — Design Spec
**Date:** 2026-06-01  
**Status:** Approved for implementation planning  
**Repo:** ss-sailsouthern-com → sailingalmanac.org (long-term home)

---

## Purpose

Build the data acquisition layer for the Sailing Almanac as a permanent, preservationist record. The crawler is not a supplemental backfill tool — it is the primary intelligence engine that makes the almanac a living record of the sailing world.

Three phases:
1. **V1 (this spec):** Article discovery, full-text extraction, Wayback preservation, multilingual support
2. **V2:** Adaptive source intelligence — crawl priority driven by engagement signals
3. **V3:** Video transcripts (YouTube), real-time race results (Regatta Network, YachtScoring)

---

## Architecture

New worker at `workers/archive/` wired into the existing BullMQ + Gemini pipeline. Nothing in the existing pipeline changes — the archive worker is a new source of `article_links` rows. Downstream workers (Gemini enrichment, entity extractor, Meilisearch indexer) treat archive-sourced articles identically to feed-ingested ones.

```
archive-discovery timer (30 min — news sitemaps)
archive-discovery timer (weekly — full sitemaps)
archive-seed CLI (manual — historical backfill per domain)
archive-pagination timer (monthly — sites without sitemaps)
                │
                ▼
     [archive-discovery queue]
     Sitemap fetch → URL list
     Pagination fallback → URL list
     Dedup against url_hash before enqueuing
                │
                ▼
       [archive-fetch queue]  ◄── continuous daemon
       Fetch article HTML
       Extract full text + metadata
       Detect language
       Write to Backblaze B2
       Write/update article_links row
                │
                ├──► [wayback-spn queue] (existing worker, extended)
                │    Trigger SPN → store wayback_url
                │
                └──► Gemini enrichment (existing — relevance scoring)
                     Entity extractor (existing)
                     Meilisearch indexer (existing)
```

---

## Scheduling

| Job | Frequency | Purpose |
|-----|-----------|---------|
| News sitemap poll | Every 30 min | Live article discovery — catches new content within 30 min of publication |
| Full sitemap crawl | Weekly | Coverage audit, historical gap detection |
| Historical backfill | Manual trigger per domain | One-time when onboarding a new domain |
| Pagination crawl | Monthly | Domains without sitemaps |
| Fetch queue daemon | Continuous | Processes whatever discovery drops in throughout the day |

The 30-minute news sitemap cadence aligns with the four daily injection windows (5am, noon, 6pm, 11pm CT). Articles published between windows are in the queue and scored before the next injection fires.

---

## Data Model

### New columns on `article_links`

```sql
ALTER TABLE article_links
  ADD COLUMN full_text_b2_key    TEXT,
  ADD COLUMN full_text_language  TEXT,              -- ISO 639-1: en, it, de, es, fr
  ADD COLUMN full_text_status    TEXT DEFAULT 'pending',
                                 -- pending | extracted | paywalled | failed
  ADD COLUMN crawler_source      TEXT DEFAULT 'feed',
                                 -- feed | sitemap | pagination | google_alert | manual
  ADD COLUMN content_type        TEXT DEFAULT 'article';
                                 -- article | video | race_result | podcast
```

`wayback_url` already exists in the schema.

### B2 storage

Path: `articles/{domain}/{url_hash}.json`

```json
{
  "url": "https://...",
  "crawled_at": "2026-06-01T10:00:00Z",
  "language": "en",
  "title": "...",
  "author": "...",
  "published_at": "2025-03-15T08:00:00Z",
  "html_raw": "...",
  "text_extracted": "Full article body text...",
  "word_count": 847,
  "schema_org": {},
  "og_tags": { "description": "...", "image": "..." }
}
```

Cost note: Backblaze B2 is $0.006/GB stored. Raw HTML runs 50–150KB per article. At 500K articles that's ~50GB = ~$0.30/month. Negligible.

### New table: `archive_domain_configs`

```sql
CREATE TABLE archive_domain_configs (
  id                    SERIAL PRIMARY KEY,
  domain                TEXT UNIQUE NOT NULL,
  tier                  SMALLINT NOT NULL DEFAULT 2,      -- 1 | 2 | 3
  languages             TEXT[] DEFAULT '{en}',
  rate_limit_ms         INTEGER DEFAULT 3000,             -- delay between requests
  sitemap_urls          TEXT[],                           -- override auto-discovery
  pagination_pattern    JSONB,                            -- fallback config
  article_link_selector TEXT,                             -- CSS selector for pagination
  is_paywalled          BOOLEAN DEFAULT FALSE,
  is_active             BOOLEAN DEFAULT TRUE,
  engagement_score      FLOAT DEFAULT 0.0,               -- V2: written by intelligence layer
  crawl_priority        SMALLINT DEFAULT 5,              -- V2: 1 (highest) to 10 (lowest)
  last_crawled_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
```

`engagement_score` and `crawl_priority` are seeded at defaults and left for the V2 intelligence layer to populate. The V1 crawler reads `crawl_priority` but doesn't write it.

### New table: `archive_crawl_runs`

One row per domain per run. Surfaces in admin dashboard.

```sql
CREATE TABLE archive_crawl_runs (
  id               SERIAL PRIMARY KEY,
  domain           TEXT NOT NULL,
  run_type         TEXT NOT NULL,    -- sitemap_news | sitemap_full | pagination | backfill
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  urls_discovered  INTEGER DEFAULT 0,
  urls_new         INTEGER DEFAULT 0,
  urls_skipped     INTEGER DEFAULT 0,
  urls_failed      INTEGER DEFAULT 0,
  status           TEXT DEFAULT 'running'  -- running | completed | failed
);
```

---

## Worker File Structure

```
workers/archive/
  src/
    index.ts                 — starts queue workers and periodic timers
    sitemap-discovery.ts     — fetches/parses sitemap.xml, sitemap_index.xml, news-sitemap.xml
    pagination-crawler.ts    — walks archive pages using domain config pattern
    article-fetcher.ts       — orchestrates fetch → extract → B2 → DB → SPN enqueue
    text-extractor.ts        — Cheerio-based extraction: title, author, date, body, schema.org, og
    domain-configs.ts        — seeds initial domain list into archive_domain_configs on first run
    lib/
      robots.ts              — fetches/caches robots.txt per domain (24h TTL), path checker
      rate-limiter.ts        — per-domain token bucket, default 1 req/3s, ±20% jitter
      dedup.ts               — url_hash check against article_links before enqueuing
      language-detect.ts     — franc-min language detection with hreflang/TLD fallback
  package.json
  tsconfig.json
  Dockerfile
```

---

## Crawl Etiquette

- `robots.txt` respected for every fetch, cached 24 hours per domain
- `User-Agent: SailingAlmanac-Crawler/1.0 (+https://sailingalmanac.org/about)` — honest identification
- Per-domain rate limiting: default 1 req/3s with ±20% jitter
- Tier 1 domains set to 1 req/5s — high-value relationships, crawl more gently
- No crawling during a domain's own peak hours if detectable (optional future enhancement)

---

## Language Support (V1)

English, Italian, German, Spanish, French.

- `franc-min` for body text language detection (offline, no API cost)
- Fallback chain: schema.org `inLanguage` → `hreflang` → domain TLD heuristic → franc
- Gemini entity extraction already handles multilingual input
- Meilisearch language-aware tokenization configured per language at index time

---

## Paywall Handling

Articles behind paywalls are indexed as records, not silently dropped.

Detection signals:
- `isAccessibleForFree: false` in schema.org JSON-LD
- Word count < 150 after extraction (metered truncation)
- Known paywall CSS class patterns

On detection: `full_text_status = 'paywalled'`, `full_text_b2_key = null`. Title, date, canonical URL, og:description, and og:image are stored. The Wayback Machine copy (via SPN) may have full content for older articles captured before the paywall was added — `wayback_url` is still attempted.

---

## Initial Domain List (seeded into `archive_domain_configs`)

Derived from corpus signal analysis. All confirmed high-quality by existing relevance scoring.

### Tier 1 — crawl priority 1, 1 req/5s
| Domain | Signal | Notes |
|--------|--------|-------|
| sailingscuttlebutt.com | 99% | Already deep coverage back to 2021 |
| sailinganarchy.com | 98% | Already deep coverage back to 2021 |
| sailingworld.com | 99% | Currently only 5 weeks coverage |
| yachtsandyachting.com | 98% | UK racing, currently 5 weeks |
| yachtingworld.com | 99% | UK ocean racing, currently 5 weeks |
| yachtingmonthly.com | 100% | UK cruising, currently 5 weeks |
| sail-world.com | 53% | High volume, major international |

### Tier 2 — crawl priority 3, 1 req/3s
| Domain | Signal | Notes |
|--------|--------|-------|
| afloat.ie | 87% | Ireland |
| mysailing.com.au | 99% | Australia |
| boatinternational.com | 97% | Superyacht/charter |
| ussailing.org | 98% | Official US Sailing |
| sailing.org.au | 97% | Official Australian Sailing |
| yachtingnz.org.nz | 96% | Official NZ Yachting |
| cruisingworld.com | 75% | US cruising |
| sailmagazine.com | 63% | US magazine |
| seahorsemagazine.com | 85% | Offshore racing, archive back to 2023 |
| americascup.com | 69% | Official AC |
| sailgp.com | 46% | Official SailGP |
| livesaildie.com | 58% | Cruising/liveaboard |

### Tier 3 — crawl priority 5, 1 req/3s, international
| Domain | Signal | Notes |
|--------|--------|-------|
| yacht.de | 72% | German |
| giornaledellavela.com | 80% | Italian |
| pressmare.it | 75% | Italian |
| boatingnz.co.nz | 68% | New Zealand |

---

## V2 — Adaptive Source Intelligence (future sprint)

The `engagement_score` and `crawl_priority` columns in `archive_domain_configs` are placeholders for this layer.

A background job (`scripts/update-source-intelligence.ts`, runs daily) will:
1. Aggregate `click_count` and `reaction_up_count` from `article_links` grouped by domain
2. Compute a rolling 30-day engagement score per domain
3. Write back to `archive_domain_configs.engagement_score`
4. Adjust `crawl_priority`: high-engagement domains crawled every 15 min, low-engagement hourly
5. Analyze outbound links in high-engagement articles — domains frequently linked to but not yet in configs surface as discovery candidates

The crawler reads `crawl_priority` to set poll frequency. V1 defaults are fine until V2 is built.

---

## V3 — Video Transcripts and Race Results (future sprint)

### YouTube transcripts
- YouTube channels (e.g. SailGP, America's Cup, sailing vloggers) added to domain configs with `content_type = 'video'`
- YouTube Data API for video metadata and auto-generated captions
- Transcript stored in B2 with timestamp-linked segments
- Entity extraction runs on transcript text identically to articles

### Real-time race results
- `content_type = 'race_result'`
- Regatta Network and YachtScoring expose results via structured pages and sometimes APIs
- Results polled on a tight interval (every 5 minutes) during active regatta windows
- Structured storage: `race_results` table with fleet, class, finish positions, boat names, elapsed time
- Published to site in real time via the edition injection pipeline

---

## Integration with Existing Pipeline

No changes to existing workers. The archive worker writes `article_links` rows with:
- `crawler_source` set to `'sitemap'` or `'pagination'`
- `content_type` set to `'article'` (V1)
- `full_text_status = 'extracted'` or `'paywalled'`
- `full_text_b2_key` pointing to B2 object

The Gemini enrichment daemon, entity extractor, and Meilisearch indexer pick these up automatically via the same `relevance_version IS NULL` and unindexed-article queries they already use.

---

## Out of Scope for V1

- JavaScript rendering (Playwright/Puppeteer) — most target sites serve HTML; add if specific domains require it
- Full-text search on body text in Meilisearch — Meilisearch is currently indexed on title/snippet; adding full-text is a separate configuration sprint
- Comment threads and forum posts — `forums.sailinganarchy.com` and `cruisersforum.com` are in the corpus but forum extraction has different patterns; defer to a dedicated forum crawler sprint
