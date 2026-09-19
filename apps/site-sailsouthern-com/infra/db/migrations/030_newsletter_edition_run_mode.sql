-- Migration 030: Add run_mode to newsletter_editions
-- Distinguishes between live production compiles and sample/test runs.
-- sample runs write to DB for observability but do NOT count as "used" for dedup.
-- live runs (default) participate in dedup and publish eligibility gates.

ALTER TABLE newsletter_editions
  ADD COLUMN IF NOT EXISTS run_mode TEXT NOT NULL DEFAULT 'live'
    CHECK (run_mode IN ('live', 'sample'));

COMMENT ON COLUMN newsletter_editions.run_mode IS
  'live = production compile (participates in dedup). sample = test run (logged for observability, excluded from dedup, archive, and analytics).';

CREATE INDEX IF NOT EXISTS idx_newsletter_editions_run_mode ON newsletter_editions(run_mode);
