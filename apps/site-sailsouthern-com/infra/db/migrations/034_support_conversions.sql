-- Migration 034: Create support_conversions table for purchase intent auditing

CREATE TABLE IF NOT EXISTS support_conversions (
  id SERIAL PRIMARY KEY,
  session_hash TEXT,
  tier_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  billing_type TEXT NOT NULL, -- 'recurring' | 'one_time'
  experiment_variant TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_conversions_tier ON support_conversions(tier_name);
CREATE INDEX IF NOT EXISTS idx_support_conversions_date ON support_conversions(created_at);

COMMENT ON TABLE support_conversions IS 'Audits support ladder clicks, tier selections, and payment intent initiations.';
