# Claude Sailing Records Project

A multi-platform sailing regatta records aggregation pipeline. Harvests, parses, and deduplicates competitive sailing data from four independent platforms into a unified SQLite analytical database.

---

## Data Sources

| Platform | Scope | Raw Format | ID Range |
|---|---|---|---|
| **YachtScoring** | Club regattas, offshore races | JSON | Sequential event IDs |
| **ICSA Techscore** | College sailing (US) | HTML | Season/slug hierarchy |
| **Regatta Network** | Club & one-design fleets | HTML | Sequential IDs 1–32000 |
| **Clubspot** | Registration-centric events | REST JSON | Paginated API |

---

## Database Files

> These are excluded from version control. Back up separately.

| File | Size | Purpose |
|---|---|---|
| `sailing_data.db` | ~400 MB | Main analytical database |
| `sailing_urls.db` | ~18 MB | URL registry for harvesters |
| `harvest.db` | — | Reserved for harvest state |

---

## Database Schema

**`regattas`** — Racing events. Platform IDs: `cs_regatta_id`, `rn_regatta_id`.

**`boats`** — Vessel records. Deduplicated by `yacht_scoring_boat_id` where available.

**`sailors`** — Individuals. Canonical identity resolved via: World Sailing ID → US Sailing ID → name+club → name only. Stored normalized for matching.

**`participation`** — Sailor × Boat × Regatta × Role (owner/skipper/crew/tactician). `boat_id` is nullable for ICSA events (no boat concept in college sailing).

**`race_results`** — Per-race finish positions and statuses.

**`families`** — Surname-based family clusters with confidence levels (high/medium/low).

**`sailor_alias`** — Maps duplicate sailor records to canonical IDs.

**`parsed_events`** — Audit trail for parsed events.

---

## Script Inventory

### Harvesters
| Script | Platform | Description |
|---|---|---|
| `sailing_urls.py` | Multi | Hybrid ICSA + YachtScoring URL discovery |
| `icsa_harvester.py` | ICSA | Walks Techscore season indexes |
| `rn_harvester.py` | Regatta Network | Sequential ID scanner (1–32000) |
| `cs_harvester.py` | Clubspot | Paginates Parse REST API |

### Parsers
| Script | Platform | Description |
|---|---|---|
| `parser.py` | YachtScoring | Parses raw JSON event folders |
| `icsa_parser.py` | ICSA | Parses HTML main + sailors pages |
| `rn_parser.py` | Regatta Network | Dynamic HTML results table parser |

### Core Utilities
| Script | Description |
|---|---|
| `detect_families.py` | Surname-based family clustering (5-tier confidence) |
| `find_family.py` | Family lookup utility |
| `migrate_boats.py` | Makes `yacht_scoring_boat_id` nullable |
| `migrate_participation_v2.py` | Makes `boat_id` nullable (ICSA support) |

### Verification
`check.py`, `check_schema.py`, `check_families.py`, `check_family.py`, `check_participation.py`, `cs_master_verify.py`, `skipper_check.py`, `j22_check.py`

### Diagnostic / One-off Scripts
`catcher-in-the-py.py`, `catcher2.py`, `catcher3.py`, `debug-test-url-scraper.py`, `devtool-test.py`, `event-entries-test.py`, `final-search-1.py`, `probe-final.py`, `probe-final2.py`, `quick-diag.py`, `races-probe.py`, `races-test.py`, `structure-test.py`, `verify-final.py`, `count-eids.py`, `find-the-harvester.py`, `icsa_catcher.py`, `inspect-edit.py`, `integer-extractor.py`, `quick-check.py`, `raw_rn.py`, `rerun.py`, `rn_catcher.py`, `sample-pull.py`

---

## Key Design Decisions

- **Resumable harvesters** — `scraper_state` table tracks `last_id_processed`; all scans can pause/resume.
- **Idempotent parsers** — `INSERT OR IGNORE` / `ON CONFLICT` patterns; safe to re-run.
- **Compound name splitting** — "Mark & Jolene Masur" → two sailor records. Delimiters: `/`, `&`, `and`, `with`.
- **Club normalization** — Strips "yacht club", "sailing club", "yc", "sc" tokens before matching.
- **boat_id nullable** — Required for ICSA, where participation is sailor-only (no vessel).

---

## Setup

```bash
# Install dependencies
pip install requests beautifulsoup4 lxml

# Run a harvester (from project root)
python icsa_harvester.py
python rn_harvester.py
python cs_harvester.py

# Parse harvested data
python icsa_parser.py
python rn_parser.py
python parser.py   # YachtScoring

# Detect families
python detect_families.py
```

> All scripts expect to be run from the project root directory where the `.db` files live.

---

## What's in `_scratch/`

Miscellaneous files that were present in the repo but belong to unrelated projects:
- `POD-Operations-Schema-and-Workflow.md` — Print-on-demand Airtable schema doc
- `POD-Airtable-Seed-Data.xlsx` — POD seed data spreadsheet
- `naag_to_airtable.py` — "No Agenda Art Generator" Airtable uploader

These can be deleted or migrated to their own repos.
