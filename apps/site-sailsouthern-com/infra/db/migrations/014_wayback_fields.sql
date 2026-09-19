-- Sprint 9C Migration 014: Wayback Fields
-- FEED PERMANENCE DOCTRINE: This migration does NOT delete or degrade existing feed_endpoints.
-- Add wayback_url if not exists.

ALTER TABLE feed_endpoints ADD COLUMN IF NOT EXISTS wayback_url TEXT;
