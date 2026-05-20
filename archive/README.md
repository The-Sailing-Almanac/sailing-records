# Archive

This directory contains retired diagnostic, exploratory, and one-off scripts from the
early development phase. They are preserved for reference but are not part of the active pipeline.

None of these scripts should be run in production. They may have hardcoded values,
incomplete logic, or depend on conditions that no longer exist.

## Notable reference material

**`cs_test.py`** — Proof-of-concept for the Clubspot Parse API. Contains the API endpoint,
app ID, request format, and sample query structure. Useful reference when building `ingestion/cs_parser.py`.

**`raw_rn.py`** — Diagnostic viewer for Regatta Network HTML files. Shows h4/h2/thead/tbody
structure of raw results pages. Useful if the rn_parser needs debugging.

**`icsa_catcher.py` / `rn_catcher.py`** — Early harvester experiments that preceded
`icsa_harvester.py` and `rn_harvester.py`.

## Full inventory

| Script | What it was |
|---|---|
| `catcher-in-the-py.py` | Early HTTP fetch experiment |
| `catcher2.py` | Same, iteration 2 |
| `catcher3.py` | Same, iteration 3 |
| `cs_test.py` | Clubspot API proof-of-concept (see note above) |
| `count-eids.py` | Counts event IDs in raw/ directory |
| `debug-test-url-scraper.py` | URL scraping debug script |
| `devtool-test.py` | Browser devtools inspection test |
| `event-entries-test.py` | YachtScoring entry list scraper experiment |
| `final-search-1.py` | Exploratory search script |
| `find-the-harvester.py` | Script discovery utility |
| `icsa_catcher.py` | Early ICSA harvester experiment |
| `inspect-edit.py` | Interactive data inspection |
| `integer-extractor.py` | Data extraction one-off |
| `probe-final.py` | HTTP probe script |
| `probe-final2.py` | Same, iteration 2 |
| `quick-check.py` | Quick DB sanity check |
| `quick-diag.py` | Quick diagnostic |
| `races-probe.py` | Race data fetch experiment |
| `races-test.py` | Race parsing test |
| `raw_rn.py` | Regatta Network HTML viewer (see note above) |
| `rerun.py` | sailing_urls.db schema inspector (misleadingly named) |
| `rn_catcher.py` | Early Regatta Network harvester experiment |
| `sample-pull.py` | Early YachtScoring scraper experiment |
| `structure-test.py` | HTML structure exploration |
| `verify-final.py` | Final verification one-off |
