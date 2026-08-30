# Consolidation Provenance

This repository is the canonical monorepo for Sailing Almanac and Layline
Scoring. The consolidation preserves the member repositories without changing
their archived working copies or authoritative data.

## Source Baselines

| Member | Default branch | Source tip represented | Canonical path |
|---|---|---|---|
| `woodyardae/sailing-records` | `master` | `87f8f909aab69634f3ecb9888b63de6df6243cdf` | `packages/sailing-records` plus shared root data, docs, and operations |
| `woodyardae/yacht_scoring` | `main` | `30fc8d171027c4c4c6394cd888ef218e7ce61425` | `apps/layline-scoring` |

The yacht-scoring history through source commit
`2796d06474e9e2dccca91680fcbcbec7c2dac2f6` was path-filtered and merged as
`063de3eba98c17aecda0f6a60e46546c7ba96540`, the second parent of merge commit
`52e2cf371ae291f0f974ac806ffac00f79a1ba44`. The only later source commit,
`30fc8d171027c4c4c6394cd888ef218e7ce61425`, adds a standalone-repository
deprecation notice. Its durable relocation information is represented in
`apps/layline-scoring/README.md`; the source-only claim that the repository
itself is archived is intentionally not copied into the active monorepo app.

## Path and Content Preservation

- The original `analysis`, `ingestion`, `schema`, and `verify` trees were moved
  with exact blob contents into
  `packages/sailing-records/src/sailing_records`.
- `data/trophy_intake/perpetual_trophy_template.csv` and
  `packages/sailing-records/src/sailing_records/schema/almanac_trophy_schema.sql`
  remain the canonical trophy intake and reference schema contracts.
- Curated source seeds remain tracked under `data/source_seeds`. Databases, raw
  harvests, and generated `exports/` remain intentionally ignored. Tracked
  generated directories contain only `.gitkeep` placeholders.
- The Layline tree at its represented source tip is content-identical under
  `apps/layline-scoring`, apart from the workspace package contract and the
  canonical-location note.

## History, License, and Build Contracts

- Both histories are reachable from the monorepo branch; no squash or
  copy-only import was used.
- Neither source repository declares a license file or GitHub-detected SPDX
  license. Consolidation therefore preserves the source licensing state and
  does not invent a license grant.
- The root `pyproject.toml` declares both workspace members. Each member has a
  Hatchling wheel contract, and `apps/layline-scoring` declares its workspace
  dependency on `sailing-records`. `uv.lock` is the reproducible dependency
  contract.

## Operational Boundary

Authoritative databases and raw source artifacts are not part of this Git
conversion. They remain governed by the existing `ops` runbooks on
`chantecler-01`. This consolidation does not deploy, migrate, rewrite, archive,
or otherwise mutate those member data stores or standalone checkouts.
