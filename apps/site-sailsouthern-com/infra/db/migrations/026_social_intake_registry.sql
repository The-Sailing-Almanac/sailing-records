-- Migration 026: Social Intake Registry Schema

CREATE TABLE IF NOT EXISTS social_intake_sources (
  id SERIAL PRIMARY KEY,
  platform TEXT NOT NULL,                  -- 'facebook', 'instagram', 'twitter', etc.
  source_url TEXT NOT NULL UNIQUE,         -- URL of the page/source
  ingestion_method TEXT NOT NULL,          -- 'inoreader_facebook', 'apify_instagram', etc.
  status TEXT NOT NULL DEFAULT 'active',   -- 'active', 'paused', 'error'
  last_success TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_intake_sources_platform ON social_intake_sources(platform);
CREATE INDEX IF NOT EXISTS idx_social_intake_sources_status ON social_intake_sources(status);
