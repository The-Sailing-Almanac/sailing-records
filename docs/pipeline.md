# Pipeline Overview

The ingestion pipeline has two stages for each platform: **harvest** (fetch and store raw source files) then **parse** (load raw files into `sailing_data.db`).

All scripts run from the project root. Raw data directories and databases are local-only (gitignored).

---

## Pipeline Map

```
[Source Platform]
      │
      ▼
[Harvester]  ──►  raw/   raw_icsa/   raw_rn/   (local, gitignored)
                  sailing_urls.db               (URL registry)
      │
      ▼
[Parser]     ──►  sailing_data.db               (main analytical DB)
      │
      ▼
[Analysis]   ──►  sailing_data.db               (families, aliases)
```

---

## Platform Status

| Platform | Harvester | Parser | Status |
|---|---|---|---|
| YachtScoring | `sailing_urls.py` | `parser.py` | Working |
| ICSA Techscore | `icsa_harvester.py` | `icsa_parser.py` | Working |
| Regatta Network | `rn_harvester.py` | `rn_parser.py` | Working |
| Clubspot | `cs_harvester.py` | **missing** | Harvest only — parser not yet built |
| Sailwave | `sailwave_harvester.py` | `sailwave_parser.py` | Seeded international parser, first pass |
| International / Europe | seeded candidates | planned | manage2sail, RegattaBase, SailingResults.net not yet implemented |

**Critical gap:** Clubspot data is harvested but `cs_parser.py` does not exist. No Clubspot records are currently in `sailing_data.db`. Building `cs_parser.py` is the top pipeline priority.

---

## Script Details

### YachtScoring

**Harvester:** `ingestion/sailing_urls.py`
- Probes sequential event IDs on YachtScoring
- Resumable via `scraper_state` table in `sailing_urls.db`
- Writes confirmed URLs to `sailing_urls.db` with `platform='YachtScoring'`

**Parser:** `ingestion/parser.py`
- Reads raw JSON folders at `raw/{eID}/` (event.json, boats.json, cumulative.json, splits.json)
- Inserts into: `regattas`, `boats`, `sailors`, `participation`, `race_results`
- Idempotent: `ON CONFLICT` / `INSERT OR IGNORE` patterns throughout
- Handles compound owner names: `"Mark & Jolene"` → two sailor records

---

### ICSA Techscore

**Harvester:** `ingestion/icsa_harvester.py`
- Crawls season indexes from the Techscore homepage (`/seasons/`)
- Seasons: f08 through present
- Writes regatta URLs to `sailing_urls.db` with `platform='ICSA'`
- Resumable

**Parser:** `ingestion/icsa_parser.py`
- Reads `raw_icsa/{season}/{slug}/` (main.html, sailors.html)
- BeautifulSoup parsing of results tables
- Inserts into: `regattas`, `sailors`, `participation`
- `boat_id` is NULL for all ICSA records (no vessel concept in college sailing)
- Sailor canonical identity via ICSA slug

---

### Regatta Network

**Harvester:** `ingestion/rn_harvester.py`
- Probes sequential regatta IDs from 1 to ~32,000+
- Classifies each as `ok` / `empty` / `missing` based on HTML structure
- Writes to `sailing_urls.db` with `platform='RegattaNetwork'`
- Resumable via `scraper_state`

**Parser:** `ingestion/rn_parser.py`
- Reads `raw_rn/{id}/results.html`
- Dynamic column detection from `<thead>` — handles structural variation across eras
- Extracts: skipper (with compound splitting), boat name, sail number, yacht club
- Inserts into: `regattas`, `boats`, `sailors`, `participation`

---

### Clubspot

**Harvester:** `ingestion/cs_harvester.py`
- Paginates the public Parse REST API (1,000 records per batch)
- No authentication required
- Fetches regattas + registrations
- API reference / proof-of-concept: `archive/cs_test.py`

**Parser:** **Not yet built**
- Target: `ingestion/cs_parser.py`
- Should load harvested Clubspot JSON into `regattas`, `boats`, `sailors`, `participation`
- Model on `rn_parser.py` for structure; reference `archive/cs_test.py` for API data shape

---

## Analysis

**Family detection:** `analysis/detect_families.py`
- Surname-based family clustering with 5-tier confidence hierarchy:
  - Tier 0: Same name + same boat → merge into canonical identity
  - Tier 1 (high): Same surname + same boat + same regatta
  - Tier 2 (medium): Same surname + persistent shared boat across years
  - Tier 3 (low): Same surname + same club
- Filters: common surnames capped at 15 sailors, year span >60 rejected, surname <3 chars rejected
- Idempotent: drops and rebuilds `families` and `sailor_alias` tables each run
- Assigns `family_id` to sailors and populates `families` table

**Family lookup:** `analysis/find_family.py`
- CLI utility for inspecting specific family records

---

## International / Multilingual Track

International expansion is documented in `docs/international.md`. Europe is the
first priority, with `manage2sail`, Sailwave published results, RegattaBase, and
SailingResults.net identified as candidate sources.

Critical ingestion rule: original source-language files, labels, table headers,
and result-cell text must be preserved exactly as fetched. Translations and
English-normalized labels are derived metadata only and must never replace the
saved source wording.

Recommended first implementation:

```bash
# 1. Seed public European result URLs manually
#    data/source_seeds/europe.csv and data/source_seeds/worldwide.csv

# 2. Harvest seeded Sailwave HTML/PDF sources into raw_intl/sailwave/
python ingestion/sailwave_harvester.py

# 3. Parse static Sailwave HTML while preserving original headers/cells
python ingestion/sailwave_parser.py

# Use the bundled runtime when parsing preserved Sailwave PDFs, because it
# includes pypdf:
# C:\Users\aewoo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe ingestion\sailwave_parser.py

# 4. Link exact Sailwave sailor identities to existing platforms
python analysis/link_sailwave_aliases.py
```

---

## Recommended Run Order (from scratch)

```bash
# 1. Harvest URLs
python ingestion/icsa_harvester.py
python ingestion/rn_harvester.py
python ingestion/sailing_urls.py

# 2. Harvest Clubspot (no separate URL step)
python ingestion/cs_harvester.py

# 3. Parse (can run in any order; each is idempotent)
python ingestion/icsa_parser.py
python ingestion/rn_parser.py
python ingestion/parser.py
# python ingestion/cs_parser.py  ← not yet built

# 4. Analysis
python analysis/detect_families.py
```

---

## Known Issues and Coverage Gaps

- **Clubspot parser missing** — top priority
- **No cross-platform sailor linking** — `sailor_alias` table is ready; matching logic not built
- **ICSA coverage** — confirm `raw_icsa/` seasons are complete from f08 through present
- **Regatta Network upper bound** — `rn_harvester.py` was configured to ~32,000; confirm whether higher IDs now exist
- **International coverage** — European source expansion is not implemented yet; start with static Sailwave results and seeded manage2sail events
- **Translations** — no translation metadata schema exists yet; preserve raw source files and defer schema changes until two multilingual parsers prove the needed fields
