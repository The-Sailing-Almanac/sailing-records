-- Sprint 9B Migration 011: Email Subscriptions
-- FEED PERMANENCE DOCTRINE: Does NOT touch feed_endpoints.

CREATE TABLE IF NOT EXISTS email_subscriptions (
  id                  SERIAL PRIMARY KEY,
  email               TEXT UNIQUE NOT NULL,
  frequency           TEXT[] DEFAULT ARRAY['daily'],  -- ['daily'],['weekly'],['monday','thursday']
  is_active           BOOLEAN DEFAULT TRUE,
  confirmation_token  TEXT,
  confirmed_at        TIMESTAMPTZ,
  unsubscribed_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_email ON email_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_token ON email_subscriptions(confirmation_token);
