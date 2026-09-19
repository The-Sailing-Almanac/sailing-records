-- Sprint 9C Migration 012: Monetization Foundation
-- FEED PERMANENCE DOCTRINE: This migration does NOT alter feed_endpoints rows.

CREATE TABLE IF NOT EXISTS supporter_tiers (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  price_usd FLOAT,
  billing_type TEXT DEFAULT 'one_time',   -- 'one_time', 'monthly', 'annual', 'pwyw'
  is_active BOOLEAN DEFAULT TRUE,
  features JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS supporters (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  social_handle TEXT,
  social_platform TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  tier_id INT REFERENCES supporter_tiers(id),
  stripe_customer_id TEXT,
  stripe_payment_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  physical_gift_sent BOOLEAN DEFAULT FALSE,
  physical_gift_address JSONB,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_supporters_tier ON supporters(tier_id);
CREATE INDEX IF NOT EXISTS idx_supporters_email ON supporters(email);

CREATE TABLE IF NOT EXISTS gemini_usage_log (
  id SERIAL PRIMARY KEY,
  run_date DATE NOT NULL,
  model TEXT NOT NULL,
  calls_made INT NOT NULL,
  estimated_cost_usd FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (run_date, model)
);
