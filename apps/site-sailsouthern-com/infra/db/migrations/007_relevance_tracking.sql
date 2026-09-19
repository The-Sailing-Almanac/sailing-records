-- Migration: 007_relevance_tracking.sql
-- Add fields to track relevance scoring versions and execution timestamps.

ALTER TABLE article_links 
  ADD COLUMN IF NOT EXISTS relevance_version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS relevance_checked_at timestamp with time zone;

-- Create index to query items that haven't been evaluated by a newer scorer version
CREATE INDEX IF NOT EXISTS idx_article_links_relevance_version_checked 
  ON article_links (relevance_version, relevance_checked_at);
