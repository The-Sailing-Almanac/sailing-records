-- Migration 028: Add auth_mode column to social_post_captures
-- Tracks whether a Wayback SPN capture was made in authenticated or anonymous mode.
-- This allows pre-auth captures to be identified and upgraded if desired.

ALTER TABLE social_post_captures
  ADD COLUMN IF NOT EXISTS auth_mode TEXT NOT NULL DEFAULT 'anonymous';

COMMENT ON COLUMN social_post_captures.auth_mode IS 'authenticated | anonymous — indicates whether the SPN request used LOW key:secret auth';
