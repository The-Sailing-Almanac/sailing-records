-- infra/db/migrations/022_add_nostr_id_to_bulletins.sql

ALTER TABLE tribe_bulletins ADD COLUMN IF NOT EXISTS nostr_event_id TEXT;
