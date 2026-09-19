-- infra/db/migrations/019_tribes_and_followers.sql

CREATE TABLE entity_followers (
  id SERIAL PRIMARY KEY,
  entity_slug TEXT NOT NULL,
  follower_actor_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (entity_slug, follower_actor_uri)
);

CREATE INDEX ON entity_followers(entity_slug);

CREATE TABLE tribes (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  entity_ids INT[] NOT NULL,
  admin_email TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  activitypub_actor_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tribe_bulletins (
  id SERIAL PRIMARY KEY,
  tribe_id INT REFERENCES tribes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  author_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
