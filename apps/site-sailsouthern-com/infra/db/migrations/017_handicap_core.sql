-- infra/db/migrations/017_handicap_core.sql

CREATE TABLE phrf_regions (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  authority_url TEXT
);

CREATE TABLE phrf_ratings (
  id SERIAL PRIMARY KEY,
  region_id INT REFERENCES phrf_regions(id) ON DELETE CASCADE,
  boat_id INT REFERENCES boats(id) ON DELETE CASCADE,
  rating_base INT,                  -- sec/mile
  rating_spin INT,
  rating_nonspin INT,
  notes TEXT,
  source_url TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (region_id, boat_id)
);

CREATE INDEX ON phrf_ratings(region_id);
CREATE INDEX ON phrf_ratings(boat_id);
