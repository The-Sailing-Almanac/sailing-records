# Sailing Almanac Foundation

This repo is becoming the evidence and data foundation for the separate
`sailing-almanac` property. The product shift is from pure race-result
aggregation toward club history, annual trophies, perpetual awards, and
publishable almanac pages.

## Product Direction

`sailing-records` should continue to harvest, preserve, normalize, and verify
source data. `sailing-almanac` should consume curated exports from this database
to power public-facing club, trophy, sailor, boat, and yearbook pages.

The strongest near-term product surface is a virtual trophy room:

- Clubs can list perpetual trophies and annual award histories.
- Each trophy can show winners by year, linked regattas, boats, crews, classes,
  and source citations.
- Clubs can add media for trophies, including photos and eventually 3D scans.
- A freemium model can expose basic trophy pages for free and reserve premium
  features for richer archives, media hosting, custom branding, and verified
  historical research.

## Data Principles

- Results remain evidence-first. Trophy winners should link back to regatta,
  race, source URL, and raw/source-text provenance whenever possible.
- Annual trophy history is not always identical to event winner history. Some
  awards are class-specific, season-long, handicap-adjusted, committee-awarded,
  or manually corrected. Model awards explicitly rather than inferring all
  trophies from race results.
- Preserve original trophy names, club wording, inscriptions, and source labels.
  Normalized names are search helpers, not replacements.
- Media assets should be referenced by metadata and storage path/URL, not stored
  directly in SQLite.
- The almanac layer should support incomplete historical records. Unknown years,
  missing crew, disputed winners, and source gaps must be representable.

## Almanac Entities

### Club

A club or organizing authority. Current raw data stores club names on sailors,
regattas, and sources, but the almanac needs club identity as a first-class
entity.

Core fields:
- `club_id`
- `club_name`
- `club_name_normalized`
- `city`
- `state_region`
- `country`
- `website_url`
- `source_url`
- `verified_status`

### Trophy

A perpetual award, annual trophy, series trophy, memorial cup, class award, or
club honor.

Core fields:
- `trophy_id`
- `club_id`
- `trophy_name`
- `trophy_name_normalized`
- `award_type`
- `class_name`
- `division_name`
- `first_awarded_year`
- `description`
- `rules_or_eligibility`
- `source_url`
- `verified_status`

Award type examples:
- `perpetual`
- `annual`
- `series`
- `class`
- `junior`
- `women`
- `offshore`
- `one_design`
- `sportsmanship`
- `committee_awarded`

### Trophy Award

One year/season of a trophy's history. This is the key almanac unit.

Core fields:
- `trophy_award_id`
- `trophy_id`
- `award_year`
- `season_label`
- `regatta_id`
- `boat_id`
- `sailor_id`
- `winning_entry_name`
- `winning_club`
- `class_name`
- `division_name`
- `placement`
- `points_or_score`
- `result_status`
- `source_url`
- `source_text_id`
- `confidence`
- `notes`

Multiple rows may exist for the same trophy/year when an award has co-winners,
crew lists, divisions, or disputed/alternate records.

### Trophy Media

Photos, 3D scans, engravings, plaque images, PDFs, or archive clippings.

Core fields:
- `media_id`
- `trophy_id`
- `trophy_award_id`
- `media_type`
- `storage_uri`
- `thumbnail_uri`
- `caption`
- `creator`
- `captured_at`
- `rights_status`
- `source_url`

Media type examples:
- `photo`
- `engraving`
- `plaque`
- `3d_scan`
- `pdf`
- `archive_clipping`

## Export Contract for sailing-almanac

The first export should be a read-only SQLite or JSONL bundle generated from
`sailing_data.db`, not a live dependency on this repo's raw database.

Recommended files:

```text
exports/almanac/
  clubs.jsonl
  trophies.jsonl
  trophy_awards.jsonl
  trophy_media.jsonl
  regattas.jsonl
  boats.jsonl
  sailors.jsonl
  sources.jsonl
  result_entries.jsonl
  annual_award_candidates.jsonl
  manifest.json
```

Each export row should include stable IDs, source URLs, and enough provenance for
`sailing-almanac` to cite where a winner came from.

Generate the first bundle with:

```bash
uv run --locked python -m sailing_records.analysis.export_almanac
```

Generated export files are written under `exports/almanac/` and are gitignored.
`annual_award_candidates.jsonl` contains inferred winners based on lowest
aggregate race score per regatta/class/division; these are review candidates,
not official trophy records.

## How Existing Data Feeds This

Current tables already support parts of the almanac:

- `regattas`: event/year/source backbone.
- `boats`: winning vessel identity where available.
- `sailors`: skipper/crew/owner identity.
- `participation`: links people, boats, roles, classes, and regattas.
- `race_results`: race-level scoring evidence.
- `source_text`: original-language labels, result rows, PDF lines, and parser
  provenance.
- `sailor_alias`: cross-platform identity linking.

Missing pieces:

- First-class clubs.
- First-class trophies.
- Annual award instances.
- Trophy media and 3D scan metadata.
- Manual curation/review state.
- Curated trophy intake records.

## Proposed Implementation Phases

### Phase A: Trophy Schema and Export

- Add trophy-oriented schema migrations or reference DDL.
- Use `packages/sailing-records/src/sailing_records/analysis/export_almanac.py`
  to create JSONL exports.
- Seed initial trophy records manually for a small set of clubs.
- Link trophy awards to existing regatta/boat/sailor evidence where possible.

### Phase B: Club Trophy Intake

- Add a structured intake CSV/JSON format for clubs to submit perpetual trophy
  histories.
- Preserve submitted wording and inscriptions exactly.
- Add review states: `submitted`, `needs_source`, `verified`, `conflict`,
  `published`.

### Phase C: Virtual Trophy Room Data

- Add media metadata support for trophy photos, engravings, and 3D scans.
- Define storage layout for uploaded assets.
- Add almanac-ready exports grouped by club and trophy.

### Phase D: Product/Freemium Layer

- Free: basic club trophy room, public trophy pages, annual winners.
- Paid: verified migration help, bulk import, hosted media, 3D trophy pages,
  custom branding, private drafts, and richer almanac reports.

## Immediate Next Batch

1. Apply or adapt
   `packages/sailing-records/src/sailing_records/schema/almanac_trophy_schema.sql`
   for a pilot database.
2. Use `data/trophy_intake/perpetual_trophy_template.csv` for the first club
   trophy-history intake.
3. Run `uv run --locked python -m sailing_records.analysis.export_almanac` and
   hand the JSONL bundle to the
   `sailing-almanac` repo.
4. Pick one pilot club and model 3-5 perpetual trophies manually.
5. Replace reviewed candidate awards with curated `trophy_awards` records.
