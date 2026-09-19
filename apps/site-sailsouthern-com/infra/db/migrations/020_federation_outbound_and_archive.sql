-- infra/db/migrations/020_federation_outbound_and_archive.sql

CREATE TABLE actor_keys (
  id SERIAL PRIMARY KEY,
  actor_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sailboatdata_archives (
  id SERIAL PRIMARY KEY,
  source_url TEXT UNIQUE NOT NULL,
  page_html TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  rights_flags JSONB NOT NULL DEFAULT '{"allow_display": false, "license": "fair_use_non_commercial"}'::jsonb,
  internal_media_urls JSONB DEFAULT '[]'::jsonb,
  provenance_info JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_submissions (
  id SERIAL PRIMARY KEY,
  submission_type TEXT NOT NULL,          -- 'photo', 'story', 'rig_correction', 'owner_group'
  boat_id INT REFERENCES boats(id) ON DELETE SET NULL,
  submitter_email TEXT NOT NULL,
  content_payload JSONB NOT NULL,
  rights_grant TEXT NOT NULL,             -- license selected by submitter
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON actor_keys(actor_id);
CREATE INDEX ON sailboatdata_archives(content_hash);
CREATE INDEX ON user_submissions(boat_id);
CREATE INDEX ON user_submissions(submission_type);
