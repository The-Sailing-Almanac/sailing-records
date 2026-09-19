-- Migration 029: Add trigger_source to social_publishing_runs
-- Tracks how each publishing run was initiated (scheduler cron, manual UI, or API call)

ALTER TABLE social_publishing_runs
  ADD COLUMN IF NOT EXISTS trigger_source TEXT DEFAULT 'scheduler';

COMMENT ON COLUMN social_publishing_runs.trigger_source IS
  'How the run was initiated: ''scheduler'' (cron), ''manual'' (force-publish button), ''api'' (external trigger)';
