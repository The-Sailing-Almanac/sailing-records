# Project Handoff — Claude Sailing Records Project

**Date:** 2026-05-18  
**Prepared by:** Claude (Sonnet 4.6)  
**Audience:** Incoming project manager / developer

---

## 1. What This Project Is

A **sailing records aggregation pipeline** that harvests competitive sailing results from four public platforms, normalizes and deduplicates the data, and stores it in a unified SQLite analytical database (`sailing_data.db`, ~400 MB).

The end goal (not yet reached) is a searchable, queryable record of sailors, boats, regattas, and race results across the full landscape of US competitive sailing — enabling historical analysis, sailor career tracking, and family/club relationship mapping.

---

## 2. Current State (as of 2026-05-18)

### What Is Complete and Working

| Component | Status | Notes |
|---|---|---|
| **YachtScoring harvester** (`sailing_urls.py`) | Working | Probes sequential eIDs; resumable |
| **YachtScoring parser** (`parser.py`) | Working | Reads raw JSON folders; idempotent |
| **ICSA harvester** (`icsa_harvester.py`) | Working | Season-based crawl from Techscore homepage |
| **ICSA parser** (`icsa_parser.py`) | Working | Parses HTML main + sailors pages |
| **Regatta Network harvester** (`rn_harvester.py`) | Working | Sequential ID scanner; resumable |
| **Regatta Network parser** (`rn_parser.py`) | Working | Dynamic column detection from HTML thead |
| **Clubspot harvester** (`cs_harvester.py`) | Working | Paginates public Parse REST API |
| **Clubspot parser** | **Missing** | Harvester exists; no parser yet |
| **Database schema** | Stable | Multi-platform, nullable boat_id, migration history |
| **Family detection** (`detect_families.py`) | Working | 5-tier confidence; surname clustering |
| **Schema migrations** | Applied | boats + participation nullable migrations done |
| **URL registry** (`sailing_urls.db`) | Active | ~17 MB; platform + status per URL |
| **Main DB** (`sailing_data.db`) | Active | ~400 MB with parsed records |

### Known Gaps

1. **No Clubspot parser** — `cs_harvester.py` pulls and saves data but there is no corresponding `cs_parser.py` to load it into `sailing_data.db`. This is the next required piece.

2. **No cross-platform sailor resolution** — Sailors ingested from different platforms (e.g., same person in YachtScoring and Regatta Network) are not yet linked. The `sailor_alias` table exists for this purpose but the matching logic across platforms has not been built.

3. **No analysis/query layer** — There is no API, web UI, or reporting layer. The database is query-only via direct SQLite access.

4. **Diagnostic scripts not organized** — ~20 one-off diagnostic and test scripts remain at the project root. They were useful during development but should be reviewed, archived, or deleted.

5. **No requirements.txt / dependency manifest** — Dependencies (requests, beautifulsoup4, lxml) are used but not formally declared.

---

## 3. Product Vision (Confirmed)

The project has three output layers, all to be hosted/delivered via GitHub:

1. **Query Tool** — Searchable interface into `sailing_data.db`. Users should be able to look up a sailor's career history, a boat's regatta record, a club's participation over time, and family groupings.
2. **Visualization Layers** — Charts and graphs over the data: sailor career arcs, family/club networks, fleet-size trends, platform coverage maps, competitive hot spots by geography.
3. **Data Reports** — Curated narratives about interesting findings in the dataset — "most traveled boat," "longest active sailing family," "which college programs produce the most offshore sailors," etc.

---

## 4. Roadmap / Recommended Next Steps

### Phase 1 — Close the Pipeline (unblock Clubspot data)

- [ ] **Build `cs_parser.py`** — Parse Clubspot harvest JSON (Parse API format) into `regattas`, `boats`, `sailors`, `participation`. Model on `rn_parser.py`. Clubspot has the richest registration metadata (class, skill level, registration status).
- [ ] **Add `requirements.txt`** — Pin `requests`, `beautifulsoup4`, `lxml`. Run `pip freeze` in a clean venv to capture exact versions.
- [ ] **Triage diagnostic scripts** — Review the ~20 one-off scripts at root. Archive anything reusable to `diagnostic/`, delete dead weight.

### Phase 2 — Data Quality (maximize what the query tool can answer)

- [ ] **Cross-platform sailor linking** — Build a resolver that matches the same person across YachtScoring, Regatta Network, and Clubspot. Hierarchy: World Sailing ID → US Sailing ID → name+club fuzzy match. Populate `sailor_alias`.
- [ ] **ICSA coverage audit** — Confirm `raw_icsa/` seasons are complete from f08 through present. Re-run `icsa_harvester.py` for gaps.
- [ ] **Regatta Network coverage audit** — Confirm current `last_id_processed` in `scraper_state`. IDs above 32000 may now exist.
- [ ] **Data validation pass** — Run `cs_master_verify.py` and the check_*.py suite. Document pass/fail counts and any constraint violations.

### Phase 3 — Query Tool

- [ ] **Design the query interface** — Decide: CLI tool (`query.py`), local web app (Flask/FastAPI), or notebook-based (Jupyter). Given the visualization requirement, a lightweight web app serves all three output types best.
- [ ] **Core queries to implement:**
  - Sailor profile: all regattas, boats, results, family links
  - Boat profile: all regattas, all sailors who have sailed it
  - Regatta lookup: entrants, results, fleet breakdown
  - Club ranking: most active clubs over time
  - Family tree: all members, shared boats, year span
- [ ] **GitHub repo + README for the query tool** — Make it runnable by a non-developer (DB path configurable, clear CLI args or web UI instructions).

### Phase 4 — Visualization Layers

Suggested stack: **Plotly Dash** or **Observable/D3** (if web-first). Plotly Dash integrates cleanly with Python/SQLite and supports interactive charts without a separate frontend build step.

Suggested first visualizations (high impact, achievable with existing data):
- [ ] **Sailor activity timeline** — Horizontal bar chart of a sailor's regatta participation by year and platform
- [ ] **Family network graph** — Force-directed graph of sailor families (nodes = sailors, edges = shared boat/regatta/surname)
- [ ] **Fleet-size trend** — Line chart of boats/sailors per year across all platforms
- [ ] **Geographic heat map** — Regatta locations plotted on a US map by city/state
- [ ] **Platform coverage** — Stacked bar of records by platform and year

### Phase 5 — Data Reports

Reports are narrative + chart combinations. Suggested first reports:
- [ ] **"The 100-Regatta Sailors"** — Sailors with the most lifetime regatta appearances
- [ ] **"Family Dynasties"** — Families with the longest year spans and most members
- [ ] **"Most Traveled Boats"** — Boats appearing across the most events, cities, and years
- [ ] **"College to Club"** — ICSA sailors who later appear in YachtScoring/RegNet as adults
- [ ] **"One-Hit Wonders"** — Sailors with exactly one regatta on record

### Long-term

- [ ] **Automated harvester scheduling** — Cron/GitHub Actions to run harvesters and push updated DB on a cadence.
- [ ] **Federation ID import** — Bulk-import World Sailing / US Sailing membership rosters to improve deduplication.
- [ ] **Photo/media linking** — Attach regatta photos to events or sailors.

---

## 5. Architecture Reference

```
sailing_urls.db          sailing_data.db
     │                        │
     │  URL registry          │  Analytical DB
     │  (platform, status)    │  (regattas, boats, sailors,
     │                        │   participation, race_results,
     │                        │   families, sailor_alias)
     │
[Harvesters] ──► raw/ raw_icsa/ raw_rn/  ──► [Parsers] ──► sailing_data.db
  - sailing_urls.py          (YachtScoring JSON)     - parser.py
  - icsa_harvester.py        (ICSA HTML)              - icsa_parser.py
  - rn_harvester.py          (RegNet HTML)            - rn_parser.py
  - cs_harvester.py          (Clubspot JSON)          - cs_parser.py  ← MISSING
```

All scripts run from the **project root** (where `.db` files live). Raw data directories (`raw/`, `raw_icsa/`, `raw_rn/`) and all `.db` files are excluded from version control.

---

## 6. Repo Hygiene Notes

This repo was initialized for remote push on 2026-05-18. The following were done during this session:

- `.gitignore` created — excludes all `.db` files, `raw*/` directories, `__pycache__/`, logs, and `diagnostic/`
- `_scratch/` directory created — holds three unrelated files that were at the project root:
  - `POD-Operations-Schema-and-Workflow.md` (print-on-demand Airtable doc)
  - `POD-Airtable-Seed-Data.xlsx` (POD seed data)
  - `naag_to_airtable.py` (No Agenda Art Generator uploader — completely unrelated project)
  - Recommend: delete or move these to their own repos before pushing

- `log.txt` is gitignored (runtime log, not source)
- `README.md` added with schema and script inventory

**Still recommended before first push:**
- Add a `requirements.txt`
- Decide whether `_scratch/` should be kept in version control at all
- Set remote origin: `git remote add origin <your-remote-url>`

---

## 7. Key Files Quick Reference

| File | What it does |
|---|---|
| `parser.py` | YachtScoring JSON → DB (core parser) |
| `icsa_parser.py` | ICSA HTML → DB |
| `rn_parser.py` | Regatta Network HTML → DB |
| `cs_harvester.py` | Clubspot API → raw JSON (harvest only) |
| `detect_families.py` | Surname-based family clustering |
| `sailing_urls.py` | URL discovery for YS + ICSA |
| `migrate_participation_v2.py` | Schema migration reference |
| `cs_master_verify.py` | Pre-Clubspot integration checks |
| `README.md` | Full script inventory and setup |

---

## 8. Questions for the Owner

1. **Query tool interface:** CLI, local web app, or Jupyter notebooks? A web app (Flask/Dash) serves all three output layers best but has higher setup cost.
2. **Visualization hosting:** Should visualizations be static exports (HTML files, PNGs) or an interactive app that reads the live DB? Static is simpler to ship; interactive requires a running server.
3. **Reports format:** Markdown files in the repo, rendered HTML, or a Notion/Substack-style publication?
4. **`_scratch/` cleanup:** The three POD/NAAG files in `_scratch/` belong to different projects. OK to delete them from this repo entirely?
5. **Cross-platform priority:** YachtScoring has the richest race data; ICSA has the most college sailors; Regatta Network has the broadest club reach. Which matters most for the first reports?
