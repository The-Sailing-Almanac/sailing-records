-- Sprint 9C Migration 013: Submissions
-- FEED PERMANENCE DOCTRINE: This migration does NOT alter feed_endpoints rows.

CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  submission_type TEXT NOT NULL,
  entity_name_or_url TEXT,
  description TEXT,
  contact_email TEXT,
  suggested_tags TEXT[],
  status TEXT DEFAULT 'pending',
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
