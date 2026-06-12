# Run Brief: Restore and Baseline

Date: 2026-06-12

## Objective

Restore the `sailing-records` checkout, pull the authoritative local-only data
from `chantecler-01`, and establish a current working baseline before further
pipeline or almanac work.

## Actions Completed

- Cloned `https://github.com/woodyardae/sailing-records.git` into the local
  workspace.
- Confirmed the working tree is on `master` tracking `origin/master`.
- Pulled authoritative data with `python ops/sync_data.py pull`.
- Verified local databases and raw source folders are present.
- Ran lightweight SQLite counts for current table and platform coverage.
- Ran `python analysis/export_almanac.py` successfully.
- Added cron-oriented ops support:
  - `ops/run_harvest_cycle.sh`
  - environment-configurable YachtScoring and Regatta Network upper bounds
  - server cron installation notes in `ops/README.md`

## Local Data Baseline

Files and folders restored locally:

| Path | Count / Size |
|---|---:|
| `sailing_data.db` | 415,305,728 bytes |
| `sailing_urls.db` | 18,272,256 bytes |
| `raw/` | 95,220 files, 641,724,855 bytes |
| `raw_icsa/` | 9,534 files, 160,072,106 bytes |
| `raw_rn/` | 13,363 files, 1,399,056,827 bytes |
| `raw_intl/` | not present locally from this sync path |

Main database counts:

| Table | Rows |
|---|---:|
| `regattas` | 43,282 |
| `boats` | 400,580 |
| `sailors` | 300,187 |
| `participation` | 1,322,221 |
| `race_results` | 1,036,239 |
| `families` | 26,498 |
| `sailor_alias` | 299,348 |
| `source_text` | 19,013 |

Regatta platform counts:

| Platform | Regattas |
|---|---:|
| Clubspot | 18,125 |
| RegattaNetwork | 13,334 |
| YachtScoring | 7,046 |
| ICSA | 4,762 |
| Sailwave | 15 |

Participation and result coverage by platform:

| Platform | Participation Rows | Race Results | Distinct Linked Boats |
|---|---:|---:|---:|
| Clubspot | 482,228 | 0 | 81,388 |
| RegattaNetwork | 436,383 | 0 | 86,550 |
| YachtScoring | 342,490 | 1,031,707 | 104,186 |
| ICSA | 60,740 | 0 | 0 |
| Sailwave | 380 | 4,532 | 317 |

URL registry counts:

| Platform | Status | Rows |
|---|---|---:|
| ICSA | pending | 4,768 |
| RegattaNetwork | empty | 18,448 |
| RegattaNetwork | ok | 13,363 |
| Sailwave | err-403 | 1 |
| Sailwave | index | 1 |
| Sailwave | ok | 13 |
| Sailwave | pdf | 2 |
| YachtScoring | pending | 59,990 |

## Findings

- The checkout and authoritative data are restored and usable locally.
- The almanac export runs cleanly against the restored database and writes the
  expected ignored bundle under `exports/almanac/`.
- The current docs still describe Clubspot as harvest-only with a missing
  parser, but the live database contains substantial Clubspot data:
  18,125 regattas and 482,228 participation rows.
- `ingestion/cs_harvester.py` appears to be an all-in-one harvester/importer
  that writes Clubspot records directly into `sailing_data.db`.
- The documented sync script currently pulls `raw`, `raw_icsa`, and `raw_rn`,
  but not `raw_intl`. This matters because Sailwave source provenance exists in
  the database and prior progress logs mention uploaded `raw_intl/sailwave/`
  artifacts.
- Country normalization remains uneven (`US`, `USA`, blank, empty string,
  `United States`, etc.), which will affect almanac exports and any country-
  level reporting.

## Almanac Export Smoke Test

Generated manifest: `exports/almanac/manifest.json`

| Export | Rows |
|---|---:|
| `clubs.jsonl` | 60,386 |
| `regattas.jsonl` | 43,282 |
| `boats.jsonl` | 400,580 |
| `sailors.jsonl` | 300,187 |
| `sources.jsonl` | 19,013 |
| `result_entries.jsonl` | 212,622 |
| `annual_award_candidates.jsonl` | 24,656 |
| `trophies.jsonl` | 0 |
| `trophy_awards.jsonl` | 0 |
| `trophy_media.jsonl` | 0 |

## Recommended Next Steps

1. Decide whether to update docs to reflect the current Clubspot reality:
   parser missing as a separate file, but Clubspot import exists in
   `cs_harvester.py`.
2. Install the server cron entries from `ops/README.md` on `chantecler-01`.
3. Extend or run a separate sync path for `raw_intl/` if Sailwave source files
   are needed locally.
4. Pick one pilot club for trophy/almanac modeling and use
   `data/trophy_intake/perpetual_trophy_template.csv` as the intake shape.
