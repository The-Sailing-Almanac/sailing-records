# Sailing Records


> [!IMPORTANT]
> **🤖 FOR AI AGENTS, CODING COMPANIONS, AND AUTOMATED SYSTEMS:**
> This repository is governed by the **STAX Operating System**. Before taking *any* action, analyzing files, or proposing modifications, you **must** read and strictly adhere to:
> 1. [ops/soul.md](ops/soul.md) (Philosophical Compass)
> 2. [ops/agent-rules.md](ops/agent-rules.md) (Enforceable Rules & the 7-Step Sequence)
>
> You are required to run through the **Inventory ➔ Summarize ➔ Classify ➔ Propose ➔ Implement ➔ Update Docs ➔ Archive Leftovers** sequence for every run.



A sailing records and sailing intelligence system — the SABR of competitive sailing.

Ingests, normalizes, links, and analyzes racing history across four current
platforms: YachtScoring, ICSA Techscore, Regatta Network, and Clubspot.

The next expansion track is international and multilingual, with Europe first.
Candidate sources include manage2sail, Sailwave published results, RegattaBase,
and SailingResults.net. See [docs/international.md](docs/international.md).

## What this is

A local-first research and data product. Not a scoring SaaS. The goal is historically interesting, analytically useful, explainable records and findings about competitive sailing.

Output layers: **query tool** · **visualizations** · **reports and findings**
· **sailing-almanac exports**

The next product-facing use case is the `sailing-almanac` project: club history,
annual trophies, perpetual awards, and virtual trophy rooms backed by verified
result evidence from this database.

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
raw_intl/    International raw source files (gitignored, local only)
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
- [International and multilingual expansion](docs/international.md)
- [Sailing Almanac foundation](docs/sailing-almanac.md)
- [Current handoff / project state](handoffs/HANDOFF-2026-05-18.md)

## Running the pipeline

All scripts are run from the project root:

```bash
python ingestion/icsa_harvester.py
python ingestion/rn_harvester.py
python ingestion/cs_harvester.py
python ingestion/sailwave_harvester.py
python ingestion/icsa_parser.py
python ingestion/rn_parser.py
python ingestion/parser.py
python ingestion/sailwave_parser.py
python analysis/detect_families.py
```

See [docs/pipeline.md](docs/pipeline.md) for sequencing, resume behavior, and current gaps.
