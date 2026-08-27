# Sailing Almanac & Layline Scoring

> [!IMPORTANT]
> **🤖 FOR AI AGENTS, CODING COMPANIONS, AND AUTOMATED SYSTEMS:**
> This repository is governed by the **STAX Operating System**. Before taking *any* action, analyzing files, or proposing modifications, you **must** read and strictly adhere to:
> 1. [ops/soul.md](ops/soul.md) (Philosophical Compass)
> 2. [ops/agent-rules.md](ops/agent-rules.md) (Enforceable Rules & the 7-Step Sequence)
>
> You are required to run through the **Inventory ➔ Summarize ➔ Classify ➔ Propose ➔ Implement ➔ Update Docs ➔ Archive Leftovers** sequence for every run.

**Sailing Almanac** is the keystone repository for competitive sailing intelligence, historical racing records, perpetual trophy databases, and modern club race scoring systems.

---

## Monorepo Architecture

This monorepo is managed with the modern **`uv` Workspace Standard**:

```text
sailing-almanac/
├── pyproject.toml              # Root workspace manifest
├── uv.lock
├── .env.example
│
├── packages/
│   └── sailing-records/        # Core pipeline package
│       ├── pyproject.toml
│       └── src/sailing_records/
│           ├── ingestion/      # Harvesters & parsers (YachtScoring, ICSA, Regatta Network, Clubspot, Sailwave)
│           ├── analysis/       # Family detection & almanac export engine
│           ├── schema/         # SQLite schema & migration tooling
│           └── verify/         # Integrity checking scripts
│
├── apps/
│   └── layline-scoring/        # Layline Scoring specifications & SaaS engine
│       ├── pyproject.toml
│       └── docs/               # Product brief, roadmap, competitive analysis, feature parity
│
├── data/                       # Seeds, trophy intake, schema SQL (database files .db gitignored)
├── docs/                       # Monorepo technical documentation
└── ops/                        # Operational runbooks & sync automation
```

---

## Quickstart & Development

### 1. Environment Setup
```bash
# Install workspace dependencies via uv
uv sync

# Run workspace tests
uv run pytest
```

### 2. Running Data Pipelines
```bash
# Harvest and parse data
uv run python -m sailing_records.ingestion.icsa_harvester
uv run python -m sailing_records.ingestion.parser

# Run family detection and exports
uv run python -m sailing_records.analysis.detect_families
uv run python -m sailing_records.analysis.export_almanac
```

---

## Consolidated Repositories
* **`sailing-records`**: Ingestion, historical database, and trophy almanac engine (`packages/sailing-records`).
* **`yacht_scoring`** (`layline-scoring`): Scoring rules, race series management, and SaaS specifications (`apps/layline-scoring`).
