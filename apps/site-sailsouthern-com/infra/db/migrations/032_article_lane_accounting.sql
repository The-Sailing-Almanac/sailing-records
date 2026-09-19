-- Migration 032: Add article lane accounting columns and processing controls table

ALTER TABLE article_links
  ADD COLUMN IF NOT EXISTS intake_source VARCHAR(50) DEFAULT 'feed',
  ADD COLUMN IF NOT EXISTS processing_lane VARCHAR(50) DEFAULT 'current';

-- Create processing_controls table
CREATE TABLE IF NOT EXISTS processing_controls (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
  max_items_per_run INTEGER DEFAULT 2000,
  daily_cap INTEGER DEFAULT 10000,
  pause_historical BOOLEAN DEFAULT FALSE,
  low_spend_mode BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default control values
INSERT INTO processing_controls (id, max_items_per_run, daily_cap, pause_historical, low_spend_mode)
VALUES ('default', 2000, 10000, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Backfill Inoreader backfill rows
UPDATE article_links
SET intake_source = 'inoreader',
    processing_lane = 'historical'
WHERE metadata->>'source' = 'inoreader_backfill';

-- Backfill Inoreader webhook rows
UPDATE article_links
SET intake_source = 'inoreader',
    processing_lane = 'current'
WHERE metadata->>'source' = 'inoreader_webhook';

-- Backfill Feedly webhook rows
UPDATE article_links
SET intake_source = 'feedly',
    processing_lane = 'current'
WHERE metadata->>'source' = 'feedly_webhook';

-- Backfill Evernote historical imports (where metadata is null and creation timestamp is older or null, or default to historical for all existing nulls)
UPDATE article_links
SET intake_source = 'evernote',
    processing_lane = 'historical'
WHERE metadata IS NULL OR jsonb_typeof(metadata) = 'null';
