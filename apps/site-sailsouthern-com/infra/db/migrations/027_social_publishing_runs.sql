-- Migration 027: Social Publishing Runs Tracker

CREATE TABLE IF NOT EXISTS social_publishing_runs (
  id SERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,                     -- e.g. 'micro_edition_publish'
  run_status TEXT NOT NULL,                  -- 'running', 'success', 'failed'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  summary_counts JSONB DEFAULT '{}',          -- e.g. { "deliveries": 3, "failures": 0 }
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_publishing_runs_job_name ON social_publishing_runs(job_name);
CREATE INDEX IF NOT EXISTS idx_social_publishing_runs_run_status ON social_publishing_runs(run_status);
CREATE INDEX IF NOT EXISTS idx_social_publishing_runs_started_at ON social_publishing_runs(started_at);
