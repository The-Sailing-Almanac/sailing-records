-- Sprint 9B Migration 010: Editorial Engine
-- FEED PERMANENCE DOCTRINE: This migration does NOT alter feed_endpoints rows.
-- SCORING DOCTRINE: popularity_score is an override signal. Popular stories can be
--   re-surfaced regardless of freshness. Freshness only gates the morning front page.
--
-- NOTE: article_links.id is UUID, so FKs to it are UUID type.
--       newsletter_editions.id and entities.id are SERIAL (INT) — new tables.

-- ── newsletter_editions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_editions (
  id              SERIAL PRIMARY KEY,
  edition_date    DATE NOT NULL,
  edition_type    TEXT DEFAULT 'daily',           -- 'daily', 'weekly'
  edition_label   TEXT,                           -- 'Morning Edition', 'Monday Weekly'
  status          TEXT DEFAULT 'draft',           -- 'draft', 'published', 'archived'
  trend_threshold FLOAT,
  compiled_at     TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(edition_date, edition_type)
);

-- ── newsletter_slots ──────────────────────────────────────────────────────────
-- article_id is UUID because article_links.id is UUID
CREATE TABLE IF NOT EXISTS newsletter_slots (
  id                  SERIAL PRIMARY KEY,
  edition_id          INT REFERENCES newsletter_editions(id) ON DELETE CASCADE,
  article_id          UUID REFERENCES article_links(id),          -- UUID FK
  section             TEXT NOT NULL,        -- 'front-page','americas-cup','college-sailing'
  section_display_name TEXT,
  slot_position       INT NOT NULL,
  injection_type      TEXT DEFAULT 'morning', -- 'morning','noon','6pm','11pm','weekly'
  injected_at         TIMESTAMPTZ DEFAULT NOW(),
  is_active           BOOLEAN DEFAULT TRUE,
  bumped_to_section   TEXT,
  bumped_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_newsletter_slots_edition   ON newsletter_slots(edition_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_slots_article   ON newsletter_slots(article_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_slots_section   ON newsletter_slots(section);

-- ── entity_types ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entity_types (
  id          SERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  label       TEXT NOT NULL,
  description TEXT
);

-- ── entities ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entities (
  id              SERIAL PRIMARY KEY,
  entity_type_id  INT REFERENCES entity_types(id) NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  canonical_name  TEXT NOT NULL,
  aliases         TEXT[],
  description     TEXT,
  dominant_color  TEXT DEFAULT '#0a6e8a',
  metadata        JSONB DEFAULT '{}',
  is_verified     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entities_entity_type ON entities(entity_type_id);
CREATE INDEX IF NOT EXISTS idx_entities_slug        ON entities(slug);

-- ── entity_mentions ───────────────────────────────────────────────────────────
-- article_id is UUID because article_links.id is UUID
CREATE TABLE IF NOT EXISTS entity_mentions (
  id              SERIAL PRIMARY KEY,
  article_id      UUID REFERENCES article_links(id) ON DELETE CASCADE,  -- UUID FK
  entity_id       INT REFERENCES entities(id),
  confidence      FLOAT,
  mention_text    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity  ON entity_mentions(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_article ON entity_mentions(article_id);
