-- Migration 033: Create resend_email_stats table

CREATE TABLE IF NOT EXISTS resend_email_stats (
  issue_date DATE PRIMARY KEY,
  sent INTEGER DEFAULT 0,
  delivered INTEGER DEFAULT 0,
  opened INTEGER DEFAULT 0,
  clicked INTEGER DEFAULT 0,
  bounced INTEGER DEFAULT 0,
  complained INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE resend_email_stats IS 'Stores summary email delivery and engagement statistics synced from Resend.';
