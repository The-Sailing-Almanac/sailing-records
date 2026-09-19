-- Sprint 9A Migration 009: Entity dominant color
-- Used by the symbol library to tint entity-specific SVG symbols.

ALTER TABLE entities ADD COLUMN IF NOT EXISTS dominant_color TEXT DEFAULT '#0a6e8a';
