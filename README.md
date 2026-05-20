# Sailing Records

A sailing records and sailing intelligence system — the SABR of competitive sailing.

Ingests, normalizes, links, and analyzes racing history across four platforms:
YachtScoring, ICSA Techscore, Regatta Network, and Clubspot.

## What this is

A local-first research and data product. Not a scoring SaaS. The goal is historically interesting, analytically useful, explainable records and findings about competitive sailing.

Output layers: **query tool** · **visualizations** · **reports and findings**

## Repo layout

```
ingestion/   harvesters and parsers (the data pipeline)
analysis/    family detection, query utilities
schema/      migration scripts (historical reference)
verify/      data validation and integrity checks
archive/     retired diagnostic and one-off scripts
docs/        schema reference, source notes, pipeline documentation
handoffs/    project manager handoff documents and progress logs
raw/         YachtScoring raw JSON (gitignored, local only)
raw_icsa/    ICSA Techscore raw HTML (gitignored, local only)
raw_rn/      Regatta Network raw HTML (gitignored, local only)
diagnostic/  raw HTML specimens for parser development reference
```

## Key databases (local only, gitignored)

| File | Purpose |
|---|---|
| `sailing_data.db` | Main analytical database (~400 MB) |
| `sailing_urls.db` | URL registry for harvesters |

## Docs

- [Pipeline overview](docs/pipeline.md)
- [Schema reference](docs/schema.md)
- [Data sources and provenance](docs/sources.md)
- [Current handoff / project state](handoffs/HANDOFF-2026-05-18.md)

## Running the pipeline

All scripts are run from the project root:

```bash
python ingestion/icsa_harvester.py
python ingestion/rn_harvester.py
python ingestion/cs_harvester.py
python ingestion/icsa_parser.py
python ingestion/rn_parser.py
python ingestion/parser.py
python analysis/detect_families.py
```

See [docs/pipeline.md](docs/pipeline.md) for sequencing, resume behavior, and current gaps.
