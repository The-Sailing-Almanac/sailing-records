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

## 3. Roadmap / Recommended Next Steps

### Immediate (unblock the pipeline)

- [ ] **Build `cs_parser.py`** — Parse Clubspot harvest data (JSON format from Parse API) into `regattas`, `boats`, `sailors`, `participation` tables. Model on `rn_parser.py` for structure.
- [ ] **Add `requirements.txt`** — Pin `requests`, `beautifulsoup4`, `lxml`, and any other active dependencies.
- [ ] **Triage diagnostic scripts** — Review the ~20 one-off scripts. Archive keepers to `diagnostic/`, delete dead weight.

### Near-term (data quality)

- [ ] **Cross-platform sailor linking** — Build a resolver that matches YachtScoring, Regatta Network, and Clubspot sailors to a single canonical identity. Use World Sailing ID or US Sailing ID where available; fall back to name+club fuzzy match. Update `sailor_alias` table.
- [ ] **Verify ICSA parse coverage** — Confirm `raw_icsa/` season coverage is complete (f08 through present). Re-run harvester for any missing seasons.
- [ ] **Regatta Network coverage audit** — `rn_harvester.py` targets IDs 1–32000. Confirm current `last_id_processed` and whether higher IDs now exist.

### Medium-term (usability)

- [ ] **Query/reporting layer** — A simple CLI query tool (`query.py`) or Flask API to search sailors, boats, and results without needing direct SQLite access.
- [ ] **Export pipeline** — CSV or JSON exports of key views (sailor career history, regatta rosters, family groupings) for downstream use (Airtable, spreadsheets, etc.).
- [ ] **Automated harvester scheduling** — Cron or scheduled task to run harvesters on a regular cadence and keep the DB current.

### Long-term (product)

- [ ] **Web interface** — Searchable UI for sailor/regatta lookup.
- [ ] **Photo/media linking** — Attach regatta photos to events or sailors.
- [ ] **Federation ID import** — Bulk-import World Sailing / US Sailing ID rosters to improve deduplication accuracy.

---

## 4. Architecture Reference

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

## 5. Repo Hygiene Notes

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

## 6. Key Files Quick Reference

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

## 7. Questions for the Owner

1. **What is the intended end product?** Query tool, public website, Airtable integration, or just a research database?
2. **Which platform should be prioritized?** YachtScoring has the richest race data; ICSA has the most college sailors; Regatta Network has the broadest club coverage.
3. **Should `_scratch/` files be deleted?** They are from unrelated projects and have no relationship to sailing records.
4. **Is there a target for cross-platform sailor linking?** The `sailor_alias` table is ready; the matching logic needs to be scoped.
5. **Remote repo location?** GitHub, GitLab, or private server (`chantecler-01`)?
