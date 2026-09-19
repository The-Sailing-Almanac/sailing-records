-- Migration 023: Handicap Systems Report & Podcast Namespace Schema Additions

-- ── Handicap Systems Tables ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS handicap_systems (
  id              SERIAL PRIMARY KEY,
  system_slug     TEXT UNIQUE NOT NULL,           -- 'phrf', 'orc', 'irc', 'd-pn'
  name            TEXT NOT NULL,                  -- 'Performance Handicap Racing Fleet'
  authority_name  TEXT,
  authority_website TEXT,
  formula_metadata JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS handicap_source_registry (
  id              SERIAL PRIMARY KEY,
  system_id       INT REFERENCES handicap_systems(id) ON DELETE CASCADE,
  source_name     TEXT NOT NULL,                  -- e.g. 'US Sailing PHRF'
  source_url      TEXT,
  import_frequency TEXT DEFAULT 'monthly',
  last_imported_at TIMESTAMPTZ,
  rights_attribution TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS handicap_systems_reports (
  id              SERIAL PRIMARY KEY,
  report_date     DATE NOT NULL,
  system_slug     TEXT NOT NULL,
  total_boats_evaluated INT DEFAULT 0,
  average_rating  DOUBLE PRECISION,
  min_rating      DOUBLE PRECISION,
  max_rating      DOUBLE PRECISION,
  distribution_data JSONB DEFAULT '{}'::jsonb,
  insights_markdown TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(report_date, system_slug)
);

-- ── Podcast Namespace Schema Additions ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS podcast_shows (
  feed_endpoint_id UUID REFERENCES feed_endpoints(id) ON DELETE CASCADE PRIMARY KEY,
  podcast_guid     TEXT UNIQUE,                   -- podcast:guid
  funding_url      TEXT,                          -- podcast:funding
  funding_text     TEXT,
  license          TEXT,                          -- podcast:license
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS podcast_episodes (
  article_link_id  UUID REFERENCES article_links(id) ON DELETE CASCADE PRIMARY KEY,
  episode_guid     TEXT UNIQUE,                   -- <guid> in RSS or podcast:guid
  license          TEXT,                          -- podcast:license
  live_item_readiness TEXT,                       -- podcast:liveItem status ('pending', 'live', 'ended')
  live_item_starts TIMESTAMPTZ,
  live_item_ends   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS podcast_transcripts (
  id              SERIAL PRIMARY KEY,
  article_link_id UUID REFERENCES article_links(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,                  -- podcast:transcript url
  type            TEXT NOT NULL,                  -- podcast:transcript type (e.g. 'application/srt')
  language        TEXT,                           -- podcast:transcript language
  rel             TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS podcast_people (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  role            TEXT,                           -- podcast:person role (e.g. 'host', 'guest')
  group_name      TEXT DEFAULT 'cast',            -- podcast:person group (e.g. 'cast', 'creative')
  href            TEXT,
  img             TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS podcast_episode_people (
  article_link_id UUID REFERENCES article_links(id) ON DELETE CASCADE,
  person_id       INT REFERENCES podcast_people(id) ON DELETE CASCADE,
  PRIMARY KEY (article_link_id, person_id)
);

CREATE TABLE IF NOT EXISTS podcast_remote_references (
  id              SERIAL PRIMARY KEY,
  article_link_id UUID REFERENCES article_links(id) ON DELETE CASCADE,
  remote_feed_guid TEXT,                          -- podcast:remoteItem feedGuid
  remote_item_guid TEXT,                          -- podcast:remoteItem itemGuid
  remote_url      TEXT,
  medium          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
