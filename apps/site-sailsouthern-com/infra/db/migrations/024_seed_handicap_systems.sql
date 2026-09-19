-- Migration 024: Seed Canonical Handicap Systems and Sources

INSERT INTO handicap_systems (system_slug, name, authority_name, authority_website, formula_metadata)
VALUES
  ('phrf', 'Performance Handicap Racing Fleet', 'US Sailing', 'https://www.ussailing.org/competition/rules-offshore/phrf/', '{"type": "empirical", "parameters": ["base", "spin", "nonspin"]}'::jsonb),
  ('orc', 'Offshore Racing Congress', 'Offshore Racing Congress', 'https://www.orc.org', '{"type": "vpp", "parameters": ["gph", "osn", "triple_number"]}'::jsonb),
  ('irc', 'International Rating Certificate', 'Royal Ocean Racing Club', 'https://ircrating.org', '{"type": "secret_empirical", "parameters": ["tcc"]}'::jsonb)
ON CONFLICT (system_slug) DO UPDATE
SET name = EXCLUDED.name,
    authority_name = EXCLUDED.authority_name,
    authority_website = EXCLUDED.authority_website,
    formula_metadata = EXCLUDED.formula_metadata;

-- Seed default regional registries
INSERT INTO handicap_source_registry (system_id, source_name, source_url, import_frequency, is_active)
SELECT id, 'US Sailing PHRF Database', 'https://www.ussailing.org', 'monthly', TRUE
FROM handicap_systems WHERE system_slug = 'phrf'
ON CONFLICT DO NOTHING;

INSERT INTO handicap_source_registry (system_id, source_name, source_url, import_frequency, is_active)
SELECT id, 'ORC Sailor Services API', 'https://www.orc.org/index.asp?id=23', 'daily', TRUE
FROM handicap_systems WHERE system_slug = 'orc'
ON CONFLICT DO NOTHING;

INSERT INTO handicap_source_registry (system_id, source_name, source_url, import_frequency, is_active)
SELECT id, 'Seahorse Rating (IRC)', 'https://ircrating.org', 'monthly', TRUE
FROM handicap_systems WHERE system_slug = 'irc'
ON CONFLICT DO NOTHING;
