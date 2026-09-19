-- 1. Rename existing empty boats table to yachts to free up the "boats" namespace
ALTER TABLE participation DROP CONSTRAINT IF EXISTS participation_boat_id_fkey;
ALTER TABLE race_results DROP CONSTRAINT IF EXISTS race_results_boat_id_fkey;

ALTER TABLE boats RENAME TO yachts;

ALTER TABLE participation 
  ADD CONSTRAINT participation_boat_id_fkey 
  FOREIGN KEY (boat_id) REFERENCES yachts(id) ON DELETE CASCADE;

ALTER TABLE race_results 
  ADD CONSTRAINT race_results_boat_id_fkey 
  FOREIGN KEY (boat_id) REFERENCES yachts(id) ON DELETE CASCADE;

-- 2. Create new boats table for Rig Spec Graph
CREATE TABLE boats (
  id SERIAL PRIMARY KEY,
  builder_name TEXT,
  model_name TEXT NOT NULL,
  variant_name TEXT,        -- e.g., Mk II, Tall Rig
  year_start INT,
  year_end INT,
  hull_type TEXT,
  rig_type TEXT,
  displacement_kg DOUBLE PRECISION,
  ballast_kg DOUBLE PRECISION,
  loa_m DOUBLE PRECISION,
  lwl_m DOUBLE PRECISION,
  beam_m DOUBLE PRECISION,
  draft_m DOUBLE PRECISION,
  sail_area_main_m2 DOUBLE PRECISION,
  sail_area_jib_m2 DOUBLE PRECISION,
  sail_area_spinnaker_m2 DOUBLE PRECISION,
  upwind_sa_m2 DOUBLE PRECISION,
  downwind_sa_m2 DOUBLE PRECISION,
  rig_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE boat_sources (
  id SERIAL PRIMARY KEY,
  boat_id INT REFERENCES boats(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,                 -- 'sailboatdata', 'yachtworld', 'class_rules', etc.
  source_url TEXT NOT NULL,
  snapshot_url TEXT,
  snapshot_date TIMESTAMPTZ,
  raw_payload JSONB,                         -- raw parsed fields (numbers as strings, etc.)
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE boat_spec_consensus (
  id SERIAL PRIMARY KEY,
  boat_id INT REFERENCES boats(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,                  -- e.g. 'loa_m'
  value_numeric DOUBLE PRECISION,
  value_text TEXT,
  confidence FLOAT,                          -- 0.0 - 1.0
  num_sources INT,
  num_thumbs_up INT DEFAULT 0,
  num_flags INT DEFAULT 0,
  last_recomputed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(boat_id, field_name)
);

CREATE TABLE boat_spec_votes (
  id SERIAL PRIMARY KEY,
  boat_id INT REFERENCES boats(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  vote TEXT NOT NULL,                        -- 'up' or 'flag'
  comment TEXT,
  voter_hash TEXT,                           -- anonymized user identity
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON boat_sources(source_type);
CREATE INDEX ON boat_sources(boat_id);
CREATE INDEX ON boat_spec_consensus(boat_id);
