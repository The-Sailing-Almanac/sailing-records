# Database Schema Reference

Primary database: `sailing_data.db` (SQLite, local only, gitignored)  
URL registry: `sailing_urls.db` (SQLite, local only, gitignored)

International and multilingual parsers must preserve original source files in
`raw_intl/` and avoid replacing source-language names, labels, or result text
with translations. The first provenance table, `source_text`, is created by the
Sailwave parser.

---

## sailing_data.db

### `regattas`

Racing events from all platforms.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `event_name` | TEXT | |
| `start_date` | TEXT | |
| `end_date` | TEXT | |
| `city` | TEXT | |
| `state` | TEXT | |
| `country` | TEXT | |
| `platform` | TEXT | `YachtScoring`, `ICSA`, `RegattaNetwork`, `Clubspot` |
| `is_completed` | INTEGER | Boolean |
| `raw_event_url` | TEXT | |
| `parsed_at` | TEXT | |
| `cs_regatta_id` | TEXT | Clubspot-specific ID (nullable, unique where not null) |
| `rn_regatta_id` | INTEGER | Regatta Network ID (nullable, unique where not null) |

Indexes: `idx_cs_regatta_id`, `idx_rn_regatta_id`

---

### `boats`

Vessel records, deduplicated by `yacht_scoring_boat_id` where available.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `yacht_scoring_boat_id` | TEXT | Unique, nullable (YachtScoring internal ID) |
| `name` | TEXT | |
| `design` | TEXT | Class/design name |
| `length` | REAL | |
| `first_seen_event_id` | INTEGER | FK → regattas.id |
| `parsed_at` | TEXT | |
| `cs_sail_number` | TEXT | Clubspot sail number |
| `rn_sail_number` | TEXT | Regatta Network sail number |

Indexes: `idx_boats_name`, `idx_boats_ys_id` (unique where not null)

---

### `sailors`

Individual people. Canonical identity resolved by: World Sailing ID → US Sailing ID → name+club → name only.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `full_name` | TEXT | |
| `first_name` | TEXT | |
| `last_name` | TEXT | |
| `world_sailing_id` | TEXT | Unique, nullable |
| `us_sailing_id` | TEXT | Unique, nullable |
| `club` | TEXT | Raw club name |
| `club_normalized` | TEXT | Stripped of "yacht club", "yc", "sc" tokens |
| `city` | TEXT | |
| `state` | TEXT | |
| `country` | TEXT | |
| `match_confidence` | TEXT | `id` / `name+club` / `name_only` |
| `name_normalized` | TEXT | Lowercase, stripped for matching |
| `family_id` | INTEGER | FK → families.id (nullable) |
| `slug` | TEXT | ICSA URL slug (nullable) |
| `parsed_at` | TEXT | |

Indexes: `idx_sailors_ws`, `idx_sailors_us`, `idx_sailors_name_club`, `idx_sailors_name`, `idx_sailors_last`, `idx_sailor_slug`

---

### `participation`

Sailor × Boat × Regatta × Role associations. One row per person-per-event-per-role.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `sailor_id` | INTEGER | FK → sailors.id |
| `boat_id` | INTEGER | FK → boats.id — **nullable** (NULL for ICSA events) |
| `regatta_id` | INTEGER | FK → regattas.id |
| `role` | TEXT | `owner`, `skipper`, `crew`, `tactician` |
| `cs_class_name` | TEXT | Clubspot class (nullable) |
| `school` | TEXT | ICSA school (nullable) |
| `division` | TEXT | ICSA division (nullable) |
| `graduation_year` | INTEGER | ICSA graduation year (nullable) |
| `race_range` | TEXT | ICSA race assignment (nullable) |

Unique constraint: `(sailor_id, boat_id, regatta_id, role)`  
Indexes: `idx_part_regatta`, `idx_part_boat`, `idx_part_sailor`

**Note:** `boat_id` is nullable by design — ICSA college sailing has no vessel concept. Added via `packages/sailing-records/src/sailing_records/schema/migrate_participation_v2.py`.

---

### `race_results`

Per-race finish positions and statuses.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `regatta_id` | INTEGER | FK → regattas.id |
| `boat_id` | INTEGER | FK → boats.id |
| `class_name` | TEXT | |
| `division_name` | TEXT | |
| `circle_name` | TEXT | YachtScoring racing circle |
| `race_number` | INTEGER | |
| `finish_status` | TEXT | `FIN`, `DNF`, `DNS`, `OCS`, etc. |
| `race_value` | REAL | Scoring points for this race |
| `sort_value` | REAL | Sort order |

Unique constraint: `(regatta_id, boat_id, race_number)`  
Index: `idx_race_regatta_boat`

---

### `families`

Surname-based family clusters. Populated by `packages/sailing-records/src/sailing_records/analysis/detect_families.py`.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `surname` | TEXT | |
| `sailor_count` | INTEGER | |
| `regatta_count` | INTEGER | |
| `boat_count` | INTEGER | |
| `year_span` | INTEGER | Years between first and last regatta |
| `confidence` | TEXT | `high`, `medium`, `low` |
| `evidence` | TEXT | Tier linkages that triggered grouping |

---

### `sailor_alias`

Maps duplicate sailor records to canonical identities. Enables cross-platform deduplication.

| Column | Type | Notes |
|---|---|---|
| `sailor_id` | INTEGER PK | The duplicate record |
| `canonical_id` | INTEGER | FK → sailors.id (the kept record) |

**Note:** Cross-platform alias linking (same sailor in YachtScoring + Regatta Network + Clubspot) is not yet implemented. The table structure is ready.

---

## Translation / Source Text Tables

Do not retrofit translations by overwriting canonical fields. When multilingual
sources are implemented, use explicit translation/source-text support.

### `source_text`

Stores exact source-language labels or text snippets that were mapped into
canonical fields. Created by `packages/sailing-records/src/sailing_records/ingestion/sailwave_parser.py`.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `entity_type` | TEXT | `regatta`, `boat`, `sailor`, `participation`, `race_result`, `source_column` |
| `entity_id` | INTEGER | ID in the corresponding table, nullable for source-only labels |
| `platform` | TEXT | Source platform |
| `source_url` | TEXT | Original URL |
| `source_language` | TEXT | BCP 47 code when known, e.g. `de`, `fr`, `it`, `es` |
| `field_name` | TEXT | Canonical field or parser mapping target |
| `source_text` | TEXT | Exact source wording |
| `source_context` | TEXT | Header, cell, title, caption, PDF line, etc. |
| `parsed_at` | TEXT | |

### `translations`

Stores derived translations for search/display while preserving provenance.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `source_text_id` | INTEGER | FK -> `source_text.id` |
| `target_language` | TEXT | Usually `en` |
| `translated_text` | TEXT | Derived translation |
| `translation_method` | TEXT | Human, model, dictionary, parser rule |
| `confidence` | REAL | Nullable |
| `created_at` | TEXT | |

This table is intentionally not implemented yet; add it only when translated
display/search fields are needed.

---

## Future Sailing Almanac Tables

The `sailing-almanac` product needs trophy and club-history tables layered on
top of the existing evidence database. See `docs/sailing-almanac.md` for the
product/data model.

Candidate tables:

### `clubs`

Canonical clubs and organizing authorities.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `club_name` | TEXT | Original/display name |
| `club_name_normalized` | TEXT | Search/dedupe helper |
| `city` | TEXT | |
| `state_region` | TEXT | State/province/region |
| `country` | TEXT | |
| `website_url` | TEXT | |
| `source_url` | TEXT | |
| `verified_status` | TEXT | `unverified`, `submitted`, `verified`, `conflict` |

### `trophies`

Perpetual trophies, annual awards, class trophies, and other club honors.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `club_id` | INTEGER | FK -> `clubs.id` |
| `trophy_name` | TEXT | Original/display name |
| `trophy_name_normalized` | TEXT | Search/dedupe helper |
| `award_type` | TEXT | `perpetual`, `annual`, `series`, `class`, etc. |
| `class_name` | TEXT | Nullable |
| `division_name` | TEXT | Nullable |
| `first_awarded_year` | INTEGER | Nullable |
| `description` | TEXT | |
| `rules_or_eligibility` | TEXT | |
| `source_url` | TEXT | |
| `verified_status` | TEXT | |

### `trophy_awards`

One annual/seasonal award instance. Multiple rows may exist for co-winners,
crew, divisions, or disputed records.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `trophy_id` | INTEGER | FK -> `trophies.id` |
| `award_year` | INTEGER | |
| `season_label` | TEXT | Nullable |
| `regatta_id` | INTEGER | FK -> `regattas.id`, nullable |
| `boat_id` | INTEGER | FK -> `boats.id`, nullable |
| `sailor_id` | INTEGER | FK -> `sailors.id`, nullable |
| `winning_entry_name` | TEXT | Original/source wording |
| `winning_club` | TEXT | Original/source wording |
| `class_name` | TEXT | |
| `division_name` | TEXT | |
| `placement` | INTEGER | Usually `1`, nullable for committee awards |
| `points_or_score` | TEXT | Preserve source format |
| `result_status` | TEXT | `verified`, `submitted`, `conflict`, etc. |
| `source_url` | TEXT | |
| `source_text_id` | INTEGER | FK -> `source_text.id`, nullable |
| `confidence` | TEXT | |
| `notes` | TEXT | |

### `trophy_media`

Metadata for trophy photos, engravings, PDFs, archive clippings, and 3D scans.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `trophy_id` | INTEGER | FK -> `trophies.id` |
| `trophy_award_id` | INTEGER | FK -> `trophy_awards.id`, nullable |
| `media_type` | TEXT | `photo`, `engraving`, `3d_scan`, `pdf`, etc. |
| `storage_uri` | TEXT | Asset path or URL |
| `thumbnail_uri` | TEXT | Nullable |
| `caption` | TEXT | |
| `creator` | TEXT | |
| `captured_at` | TEXT | |
| `rights_status` | TEXT | |
| `source_url` | TEXT | |

These tables are intentionally documented first; implement them once the first
pilot club/trophy intake is selected.

---

### `parsed_events`

Audit trail for parsed events.

| Column | Type | Notes |
|---|---|---|
| `regatta_id` | INTEGER PK | FK → regattas.id |
| `parsed_at` | TEXT | |
| `boats_count` | INTEGER | |
| `sailors_count` | INTEGER | |

---

## sailing_urls.db

### `registry`

URL catalog for harvesters.

| Column | Type | Notes |
|---|---|---|
| `url` | TEXT PK | |
| `platform` | TEXT | |
| `event_name` | TEXT | |
| `status` | TEXT | `ok`, `empty`, `missing` |

### `scraper_state`

Harvester resume state.

| Column | Type | Notes |
|---|---|---|
| `key` | TEXT PK | Harvester identifier |
| `last_id_processed` | INTEGER | Resume point |

---

## Schema Change History

| Migration | Script | What it did |
|---|---|---|
| boats nullable | `packages/sailing-records/src/sailing_records/schema/migrate_boats.py` | Made `yacht_scoring_boat_id` nullable |
| participation v2 | `packages/sailing-records/src/sailing_records/schema/migrate_participation_v2.py` | Made `boat_id` nullable (ICSA support) |
