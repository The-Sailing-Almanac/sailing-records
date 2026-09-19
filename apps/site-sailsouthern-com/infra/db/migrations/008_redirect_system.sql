-- Sprint 9A Migration 008: Redirect System, Click Analytics, Article Reactions
-- FEED PERMANENCE DOCTRINE: This migration does NOT alter feed_endpoints rows.
-- LINK DOCTRINE: All outbound article links use /sendit/<hash>.
--                OG images served direct from source URL — no redirect.

-- ── redirect_links ────────────────────────────────────────────────────────────
-- Canonical lookup table: hash → canonical URL. One row per article_link.
-- article_link_id is UUID to match article_links.id (UUID primary key).
CREATE TABLE IF NOT EXISTS redirect_links (
  id          SERIAL PRIMARY KEY,
  hash        TEXT UNIQUE NOT NULL,            -- 8-char base62, deterministic from article id
  article_link_id UUID REFERENCES article_links(id) ON DELETE SET NULL,
  canonical_url TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_redirect_links_hash ON redirect_links(hash);

-- ── redirect_clicks ───────────────────────────────────────────────────────────
-- Every click through /sendit/:hash is logged here (fire-and-forget).
-- article_link_id is UUID to match article_links.id.
CREATE TABLE IF NOT EXISTS redirect_clicks (
  id              SERIAL PRIMARY KEY,
  article_link_id UUID REFERENCES article_links(id) ON DELETE CASCADE,
  redirect_hash   TEXT NOT NULL,
  subscriber_id   INT,                            -- NULL for anonymous
  source          TEXT DEFAULT 'web',             -- 'web','newsletter','email_daily','email_weekly','rss'
  utm_medium      TEXT,
  referrer        TEXT,
  ip_hash         TEXT,                           -- SHA-256(req.ip) — never raw
  clicked_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_redirect_clicks_article ON redirect_clicks(article_link_id);
CREATE INDEX IF NOT EXISTS idx_redirect_clicks_date    ON redirect_clicks(clicked_at);

-- ── article_reactions ─────────────────────────────────────────────────────────
-- Thumb up/down reactions — one per (article, session).
-- article_link_id is UUID to match article_links.id.
CREATE TABLE IF NOT EXISTS article_reactions (
  id              SERIAL PRIMARY KEY,
  article_link_id UUID REFERENCES article_links(id) ON DELETE CASCADE,
  reaction        TEXT NOT NULL,                  -- 'up' | 'down'
  session_hash    TEXT NOT NULL,                  -- SHA-256(session cookie value)
  source          TEXT DEFAULT 'web',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_link_id, session_hash)
);
CREATE INDEX IF NOT EXISTS idx_article_reactions_article ON article_reactions(article_link_id);

-- ── article_links: new columns ────────────────────────────────────────────────
ALTER TABLE article_links
  ADD COLUMN IF NOT EXISTS redirect_hash        TEXT,
  ADD COLUMN IF NOT EXISTS og_image_url         TEXT,
  ADD COLUMN IF NOT EXISTS og_image_scraped_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS event_date           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS popularity_score     FLOAT DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS click_count          INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reaction_up_count    INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reaction_down_count  INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_article_links_redirect_hash ON article_links(redirect_hash);
CREATE INDEX IF NOT EXISTS idx_article_links_popularity    ON article_links(popularity_score DESC);
