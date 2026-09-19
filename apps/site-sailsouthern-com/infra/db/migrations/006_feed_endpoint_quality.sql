-- Sprint 6: feed_endpoints validation tracking

ALTER TABLE feed_endpoints
  ADD COLUMN IF NOT EXISTS http_status INTEGER,
  ADD COLUMN IF NOT EXISTS validation_error TEXT,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_feed_endpoints_last_checked_at
  ON feed_endpoints(last_checked_at)
  WHERE last_checked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_feed_endpoints_is_active ON feed_endpoints(is_active);
