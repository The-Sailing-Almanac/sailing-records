-- infra/db/migrations/021_bulletin_replies_and_lightning.sql

CREATE TABLE bulletin_replies (
  id SERIAL PRIMARY KEY,
  bulletin_id INT NOT NULL REFERENCES tribe_bulletins(id) ON DELETE CASCADE,
  author_actor_uri TEXT NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON bulletin_replies(bulletin_id);
CREATE INDEX ON bulletin_replies(is_approved);

-- Add Lightning and Nostr keys support to federated actors
ALTER TABLE actor_keys ADD COLUMN IF NOT EXISTS lightning_address TEXT;
ALTER TABLE actor_keys ADD COLUMN IF NOT EXISTS nostr_private_key TEXT;
