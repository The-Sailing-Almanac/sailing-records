# Run Brief: Sailing Almanac Consolidation

Date: 2026-08-29

## Objective

Complete the conversion of `woodyardae/sailing-records` into the canonical
Sailing Almanac monorepo while preserving Sailing Records, importing Layline
Scoring with history, and proving current member-tip parity.

## Classification and Scope

This was a repository-structure and provenance change. It did not alter
authoritative databases, raw harvests, member working copies, or deployment
state.

## Consolidation Result

- `sailing-records/master` tip
  `87f8f909aab69634f3ecb9888b63de6df6243cdf` is preserved as the first parent
  lineage.
- `yacht_scoring/main` through
  `2796d06474e9e2dccca91680fcbcbec7c2dac2f6` is preserved under
  `apps/layline-scoring` with rewritten path-aware history.
- Current `yacht_scoring/main` tip
  `30fc8d171027c4c4c6394cd888ef218e7ce61425` contains only the standalone
  deprecation notice. Its canonical-location information was adapted into the
  live app README with explicit source provenance.
- Sailing Records Python modules are packaged under
  `packages/sailing-records/src/sailing_records`.
- Trophy intake, trophy schema, curated source seeds, handoffs, history, and
  generated-file boundaries remain represented.
- No source repository supplied a license file or detected SPDX license; none
  was fabricated during consolidation.

## Validation Boundary

Validation is performed only on `chantecler-01` from a fresh, uniquely named
isolated clone created from a Git bundle. No local dependency installation,
build, or test command is used. The isolated validation checks:

1. bundle commit and clean-worktree identity;
2. member-tip ancestry, tree parity, and path preservation;
3. tracked data, generated-file, and license contracts;
4. locked workspace synchronization, package builds, and tests.

The validation checkout and bundle are removed after the run. There is no
deployment step.
