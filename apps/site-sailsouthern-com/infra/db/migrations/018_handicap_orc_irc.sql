-- infra/db/migrations/018_handicap_orc_irc.sql

CREATE TABLE orc_certificates (
  id SERIAL PRIMARY KEY,
  external_id TEXT UNIQUE,          -- ORC Sailor Services cert ID
  boat_id INT REFERENCES boats(id) ON DELETE SET NULL,
  owner_name TEXT,
  club_name TEXT,
  gph DOUBLE PRECISION,
  loa_m DOUBLE PRECISION,
  lwl_m DOUBLE PRECISION,
  beam_m DOUBLE PRECISION,
  draft_m DOUBLE PRECISION,
  displacement_kg DOUBLE PRECISION,
  upwind_sa_m2 DOUBLE PRECISION,
  downwind_sa_m2 DOUBLE PRECISION,
  cert_year INT,
  source_url TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE irc_certificates (
  id SERIAL PRIMARY KEY,
  boat_id INT REFERENCES boats(id) ON DELETE SET NULL,
  tcc DOUBLE PRECISION,
  cert_year INT,
  source_url TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON orc_certificates(boat_id);
CREATE INDEX ON irc_certificates(boat_id);
