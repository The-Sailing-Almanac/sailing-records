-- Migration 025: Outbound Social Archive Schema

CREATE TABLE IF NOT EXISTS social_accounts (
  id SERIAL PRIMARY KEY,
  platform TEXT NOT NULL,           -- 'mastodon', 'nostr', 'bluesky'
  handle TEXT NOT NULL,             -- '@sailsouthern@social.sailingalmanac.org', npub, etc.
  display_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, handle)
);

CREATE TABLE IF NOT EXISTS social_posts (
  id SERIAL PRIMARY KEY,
  content_text TEXT NOT NULL,
  title TEXT,
  linked_entity_type TEXT,          -- 'newsletter', 'article', 'boat'
  linked_entity_id TEXT,            -- e.g. newsletter ID or article UUID
  metadata JSONB DEFAULT '{}'::jsonb,
  provenance_rights JSONB DEFAULT '{"license": "all_rights_reserved"}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_post_media (
  id SERIAL PRIMARY KEY,
  post_id INT REFERENCES social_posts(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL,          -- e.g. 'image/png', 'image/jpeg'
  alt_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_post_links (
  id SERIAL PRIMARY KEY,
  post_id INT REFERENCES social_posts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  short_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_post_deliveries (
  id SERIAL PRIMARY KEY,
  post_id INT REFERENCES social_posts(id) ON DELETE CASCADE,
  account_id INT REFERENCES social_accounts(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,           -- 'mastodon', 'nostr', 'bluesky'
  external_id TEXT,                 -- ID returned by platform (e.g. status ID, note ID, at:// URI)
  external_url TEXT,                -- public URL of the published post
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
  error_message TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_post_metrics_snapshots (
  id SERIAL PRIMARY KEY,
  post_id INT REFERENCES social_posts(id) ON DELETE CASCADE,
  delivery_id INT REFERENCES social_post_deliveries(id) ON DELETE CASCADE,
  likes_count INT DEFAULT 0,
  shares_count INT DEFAULT 0,
  replies_count INT DEFAULT 0,
  impressions_count INT DEFAULT 0,
  snapshot_time TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_post_archives (
  id SERIAL PRIMARY KEY,
  post_id INT REFERENCES social_posts(id) ON DELETE CASCADE,
  delivery_id INT REFERENCES social_post_deliveries(id) ON DELETE CASCADE,
  archive_url TEXT NOT NULL,        -- e.g. Wayback Machine SPN URL
  screenshot_url TEXT,              -- path or URL to screenshot object storage
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'completed'
);

CREATE TABLE IF NOT EXISTS social_post_revisions (
  id SERIAL PRIMARY KEY,
  post_id INT REFERENCES social_posts(id) ON DELETE CASCADE,
  revision_number INT NOT NULL,
  content_text TEXT NOT NULL,
  revised_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT
);

CREATE TABLE IF NOT EXISTS social_post_captures (
  id SERIAL PRIMARY KEY,
  post_id INT REFERENCES social_posts(id) ON DELETE CASCADE,
  delivery_id INT REFERENCES social_post_deliveries(id) ON DELETE CASCADE,
  capture_type TEXT NOT NULL,        -- 'screenshot', 'wayback_spn'
  archive_url TEXT NOT NULL,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'completed'
);

-- Seed canonical accounts so the adapters have accounts to reference
INSERT INTO social_accounts (platform, handle, display_name) VALUES 
  ('mastodon', '@sailingalmanac@social.sailingalmanac.org', 'Sailing Almanac'),
  ('nostr', 'npub1sailingalmanac', 'Sailing Almanac Nostr'),
  ('bluesky', 'sailingalmanac.org', 'Sailing Almanac Bluesky')
ON CONFLICT (platform, handle) DO NOTHING;

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_social_posts_linked ON social_posts(linked_entity_type, linked_entity_id);
CREATE INDEX IF NOT EXISTS idx_social_post_deliveries_post ON social_post_deliveries(post_id);
CREATE INDEX IF NOT EXISTS idx_social_post_deliveries_platform ON social_post_deliveries(platform);
CREATE INDEX IF NOT EXISTS idx_social_post_metrics_snapshots_post ON social_post_metrics_snapshots(post_id);
CREATE INDEX IF NOT EXISTS idx_social_post_archives_post ON social_post_archives(post_id);
CREATE INDEX IF NOT EXISTS idx_social_post_revisions_post ON social_post_revisions(post_id);
CREATE INDEX IF NOT EXISTS idx_social_post_captures_post ON social_post_captures(post_id);
