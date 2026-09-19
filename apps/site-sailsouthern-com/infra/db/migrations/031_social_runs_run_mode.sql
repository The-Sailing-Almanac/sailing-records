-- Migration 031: Add run_mode to social_publishing_runs
-- Extends trigger_source tagging with a mode flag so sample/test runs
-- are clearly visible in run history without polluting operational metrics.

ALTER TABLE social_publishing_runs
  ADD COLUMN IF NOT EXISTS run_mode TEXT NOT NULL DEFAULT 'live'
    CHECK (run_mode IN ('live', 'sample', 'dry_run'));

COMMENT ON COLUMN social_publishing_runs.run_mode IS
  'live = real production run. sample = test/verification run (suppresses archive+analytics side effects). dry_run = no-write preview.';

CREATE INDEX IF NOT EXISTS idx_social_publishing_runs_run_mode ON social_publishing_runs(run_mode);
