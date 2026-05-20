# Progress Log

Running record of completed work batches. Most recent first.

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
