-- Migration 035: Editorial gate columns
-- Adds gate status and structured audit log to article_links and newsletter_editions.

ALTER TABLE article_links
  ADD COLUMN IF NOT EXISTS editorial_gate_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS editorial_flags JSONB;

ALTER TABLE article_links
  ADD CONSTRAINT chk_article_gate_status
    CHECK (editorial_gate_status IN ('pending', 'pass', 'warn', 'block'));

CREATE INDEX IF NOT EXISTS idx_article_links_gate_status
  ON article_links (editorial_gate_status)
  WHERE editorial_gate_status IN ('warn', 'block');

ALTER TABLE newsletter_editions
  ADD COLUMN IF NOT EXISTS gate_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS gate_notes JSONB,
  ADD COLUMN IF NOT EXISTS gate_checked_at TIMESTAMPTZ;

ALTER TABLE newsletter_editions
  ADD CONSTRAINT chk_edition_gate_status
    CHECK (gate_status IN ('pending', 'pass', 'warn', 'block'));
