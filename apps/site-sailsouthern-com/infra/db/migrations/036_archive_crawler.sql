-- infra/db/migrations/036_archive_crawler.sql

ALTER TABLE article_links
  ADD COLUMN IF NOT EXISTS full_text_b2_key   TEXT,
  ADD COLUMN IF NOT EXISTS full_text_language TEXT,
  ADD COLUMN IF NOT EXISTS full_text_status   TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS crawler_source     TEXT NOT NULL DEFAULT 'feed',
  ADD COLUMN IF NOT EXISTS content_type       TEXT NOT NULL DEFAULT 'article';

ALTER TABLE article_links
  ADD CONSTRAINT chk_full_text_status
    CHECK (full_text_status IN ('pending','extracted','paywalled','failed')),
  ADD CONSTRAINT chk_content_type
    CHECK (content_type IN ('article','video','race_result','podcast'));

CREATE INDEX IF NOT EXISTS idx_article_links_full_text_status
  ON article_links (full_text_status)
  WHERE full_text_status = 'pending';

CREATE TABLE IF NOT EXISTS archive_domain_configs (
  id                    SERIAL PRIMARY KEY,
  domain                TEXT UNIQUE NOT NULL,
  tier                  SMALLINT NOT NULL DEFAULT 2,
  languages             TEXT[] DEFAULT '{en}',
  rate_limit_ms         INTEGER DEFAULT 3000,
  sitemap_urls          TEXT[],
  pagination_pattern    JSONB,
  article_link_selector TEXT,
  is_paywalled          BOOLEAN DEFAULT FALSE,
  is_active             BOOLEAN DEFAULT TRUE,
  engagement_score      FLOAT DEFAULT 0.0,
  crawl_priority        SMALLINT DEFAULT 5,
  last_crawled_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS archive_crawl_runs (
  id               SERIAL PRIMARY KEY,
  domain           TEXT NOT NULL,
  run_type         TEXT NOT NULL,
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  urls_discovered  INTEGER DEFAULT 0,
  urls_new         INTEGER DEFAULT 0,
  urls_skipped     INTEGER DEFAULT 0,
  urls_failed      INTEGER DEFAULT 0,
  status           TEXT DEFAULT 'running'
);
