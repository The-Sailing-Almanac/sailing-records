# Progress Log

Running record of completed work batches. Most recent first.

---

## 2026-06-02 — Sailing Almanac Product Pivot

**Goal:** Reframe `sailing-records` as the evidence database for the
`sailing-almanac` property, with a stronger focus on annual trophies,
perpetual awards, club history, and virtual trophy rooms.

**Work completed:**
- Added `docs/sailing-almanac.md` with the product direction and almanac data
  model
- Documented candidate almanac entities: clubs, trophies, trophy awards, and
  trophy media
- Updated `docs/schema.md` with future trophy/almanac tables
- Updated `README.md` to include almanac exports as a product-facing output
- Added `schema/almanac_trophy_schema.sql` as reference DDL for a pilot trophy
  database
- Added `data/trophy_intake/perpetual_trophy_template.csv` as the first club
  trophy-history intake format
- Added `analysis/export_almanac.py` to generate the first JSONL knowledge
  block for the `sailing-almanac` repo
- Verified the exporter against local `sailing_data.db`; generated
  `exports/almanac/` with 43,282 regattas, 399,978 boats, 299,555 sailors,
  60,386 derived clubs, 212,622 result entries, 24,656 annual award candidates,
  and 19,013 source/provenance rows

**Decisions made:**
- `sailing-records` remains the source/evidence engine; `sailing-almanac`
  should consume curated exports rather than depend directly on raw harvesting
  internals
- Trophy history must be modeled explicitly because annual awards are not always
  equivalent to regatta overall winners
- Original club wording, trophy names, inscriptions, and result source text must
  be preserved for citation and correction
- Trophy media, including future 3D scans, should be represented by metadata and
  storage URIs rather than stored inside SQLite

**Recommended next batch:** Hand the generated `exports/almanac/` bundle to the
`sailing-almanac` repo, pick one pilot club, and model 3-5 perpetual trophies
manually against existing regatta/boat/sailor evidence.

---

## 2026-05-27 — International Source Planning and Sailwave First Pass

**Goal:** Refresh the repo and define the European/international expansion path
without risking source-language data loss.

**Work completed:**
- Confirmed local `master` is up to date with `origin/master`
- Added `docs/international.md` with multilingual ingestion rules
- Added `raw_intl/` as the planned gitignored raw storage root for non-US sources
- Documented initial European candidates: manage2sail, Sailwave published
  results, RegattaBase, and SailingResults.net
- Added `data/source_seeds/europe.csv` with curated starting URLs
- Added `data/source_seeds/worldwide.csv` with Australia, New Zealand,
  Malaysia, South Africa, and global platform candidates
- Added `ingestion/sailwave_harvester.py` for seeded static Sailwave pages
- Added `ingestion/sailwave_parser.py`, which loads saved Sailwave pages into
  `sailing_data.db` and writes original headers/cell text to `source_text`
- Updated pipeline/schema docs to require original source wording, labels,
  formatting, and raw files to be preserved before any translation or
  normalization
- Harvested eight Sailwave seed URLs: one index, four HTML result pages, two
  South Africa PDF result files, and one expired/forbidden signed Malaysia URL
- Parsed four HTML result pages into local data: 4 regattas across GB/AU/NZ,
  133 participation rows, 1,656 race-result rows, and 8,729 source-text
  provenance rows
- Added merge-only ops helpers: `ops/merge_sailwave_data.py` and
  `ops/merge_sailwave_urls.py`
- Merged the Sailwave layer into the authoritative `chantecler-01` DBs without
  changing existing YachtScoring, ICSA, Regatta Network, or Clubspot counts
- Created remote backups before upload:
  `sailing_data.db.bak_sailwave_20260528_041011` and
  `sailing_urls.db.bak_sailwave_20260528_041011`
- Uploaded preserved `raw_intl/sailwave/` source artifacts to the authoritative
  server
- Expanded worldwide Sailwave seeds with additional Australia, New Zealand,
  Taiwan, Brazil, and UAE candidates
- Parsed the expanded static HTML set into 8 Sailwave regattas across GB, AU,
  NZ, Taiwan, and Brazil, with 275 participation rows, 3,206 race-result rows,
  and 14,247 source-text provenance rows
- Updated the authoritative server again using the merge-only path; existing
  non-Sailwave platform counts remained unchanged
- Created second remote backup set before the expanded upload:
  `sailing_data.db.bak_sailwave_20260528_041917` and
  `sailing_urls.db.bak_sailwave_20260528_041917`
- Verified `raw_intl/sailwave/` on the authoritative server contains 32 files
- Hardened Sailwave table detection so all 13 saved HTML result pages now parse
  (only the global index remains `no_entries`)
- Added conservative Sailwave PDF parsing via `pypdf`; two South Africa PDFs now
  create boat/race-result rows while preserving extracted PDF text in
  `source_text`
- Added `analysis/link_sailwave_aliases.py` for exact name+club Sailwave alias
  linking without rebuilding the existing alias table
- Final authoritative verification: 15 Sailwave regattas across AE/AU/BR/GB/NZ/TW/ZA,
  380 participation rows, 4,532 race-result rows, 19,013 source-text rows, and
  19 distinct Sailwave sailor aliases on the server
- Created third remote backup set before the final upload:
  `sailing_data.db.bak_sailwave_20260528_170149` and
  `sailing_urls.db.bak_sailwave_20260528_170149`

**Decisions made:**
- Europe is the first international priority, but the storage and parser rules
  apply globally
- Sailwave static HTML is the best first parser target because it is commonly
  published as preservable result pages
- manage2sail is the best high-value championship/event target, but should
  begin from seeded public URLs and preserved reports
- Translation metadata should be derived and traceable; it must not overwrite
  source-language fields or raw files
- `source_text` is the first implemented provenance table; translated display
  fields should wait until multilingual parser behavior is better understood

**Recommended next batch:** Add 25-50 more static HTML Sailwave result pages
across Australia, New Zealand, South Africa, Asia, Europe, and South America;
then add PDF extraction support for preserved Sailwave PDF result files.

---

## 2026-05-20 — Batch 2: Server Data Setup & Ops Layer

**Goal:** Move authoritative data to chantecler-01; establish rsync-based sync workflow; document ops layer in repo.

**Work completed:**
- Generated dedicated SSH deploy key on chantecler-01 (`~/.ssh/sailing-records-deploy`, ed25519)
- Configured SSH host alias `github-sailing-records` on server pointing to deploy key
- Deploy key added to GitHub repo (read-only, title: `chantecler-01`)
- Repo cloned on server: `~/sailing-records/`
- Server git remote updated to use deploy key SSH alias
- Initial data transfer (scp): `sailing_data.db`, `sailing_urls.db`, `raw/`, `raw_icsa/`, `raw_rn/`
- `ops/` directory created with `push-data.sh`, `pull-data.sh`, `ops/README.md`

**Decisions made:**
- **chantecler-01 is authoritative** for all data files — `~/sailing-records/` is the canonical copy
- One deploy key per repo (not reusing sprint-commander key) — best practice
- rsync over SSH for ongoing sync; scp used for initial bootstrap (no local rsync on Windows yet)
- `push-data.sh` / `pull-data.sh` are bash scripts, run from project root via Git Bash or WSL
- Windows rsync install: `choco install rsync` as Administrator (documented in `ops/README.md`)

**Open items:**
- Local rsync: user must run `choco install rsync` as Administrator once to enable the ops scripts
- Verify raw data transferred cleanly (spot-check on server)

**Recommended Batch 3:** Build `ingestion/cs_parser.py` — Clubspot pipeline gap is the top priority.

---

## 2026-05-18 — Batch 1: Structural Hygiene

**Goal:** Prepare repo for remote push. Establish clean folder structure per STAX sparse-root rules.

**Work completed:**
- Git initialized; initial commit made
- `.gitignore` created — excludes databases, raw data dirs, pycache, logs
- Folder structure established: `ingestion/`, `analysis/`, `schema/`, `verify/`, `archive/`, `docs/`, `handoffs/`
- 7 canonical ingestion scripts moved to `ingestion/`
- 2 analysis scripts moved to `analysis/`
- 3 schema/migration scripts moved to `schema/`
- 8 verification scripts moved to `verify/`
- ~25 diagnostic/one-off scripts moved to `archive/`
- `archive/README.md` created with full inventory and notable reference notes
- `docs/sources.md` — data provenance and ethics documentation for all 4 platforms
- `docs/schema.md` — full schema reference for `sailing_data.db` and `sailing_urls.db`
- `docs/pipeline.md` — pipeline map, per-platform script details, run order, known gaps
- `README.md` rewritten as short orientation layer; detail offloaded to `docs/`
- `requirements.txt` added with known dependencies
- `HANDOFF.md` moved to `handoffs/HANDOFF-2026-05-18.md` and updated
- `_scratch/` POD and NAAG files removed from repo (unrelated projects)
- `diagnostic/` HTML specimens (3 files) now tracked in git — removed from `.gitignore`

**Decisions made:**
- Scripts organized by function (ingestion, analysis, schema, verify, archive), not by platform
- Moved scripts safely using `git mv` — git rename history preserved
- `diagnostic/` HTML files classified as raw source specimens worth preserving in version control
- POD/NAAG files deleted from repo (confirmed by owner)
- `requirements.txt` left unpinned for now; pin to exact versions once a clean venv is validated

**Open questions carried forward:**
- Query tool interface: CLI vs. local web app vs. Jupyter?
- Visualization: static exports vs. interactive live-DB app?
- Reports format: Markdown, rendered HTML, or published?
- Cross-platform sailor linking: scope and priority?
- Remote GitHub repo URL?

**Recommended Batch 2:** Build `ingestion/cs_parser.py` (Clubspot pipeline gap) — highest priority unblocking work. See `docs/pipeline.md` and `archive/cs_test.py` for reference.

---
