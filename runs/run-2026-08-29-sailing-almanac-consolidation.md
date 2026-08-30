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

## Validation Evidence

The proof run used a bundle containing commit
`3b801ba53156baf59e547edd4ea1cf7240679fbb` and `master`, cloned into the unique
checkout `/tmp/sailing-almanac-validation-Fk546U` on `chantecler-01`.

| Check | Result |
|---|---|
| Remote toolchain | `uv 0.12.6`, Python `3.12.3` |
| Current member defaults | Sailing Records `87f8f909aab69634f3ecb9888b63de6df6243cdf`; Yacht Scoring `30fc8d171027c4c4c6394cd888ef218e7ce61425` |
| Yacht history | 13 source commits through `2796d06474e9e2dccca91680fcbcbec7c2dac2f6`, equal to the filtered-history count |
| Yacht tree | Exact match after excluding the workspace package files and removing the documented canonical-location note |
| Sailing Records tree | Exact match for `analysis`, `ingestion`, `schema`, and `verify` |
| Data contracts | Both source-seed CSVs, trophy intake CSV, and trophy schema have identical Git blob IDs |
| License contract | No license, copying, or notice file exists in either source or the consolidated tree |
| Generated-data contract | No tracked export; generated directories contain only `.gitkeep` |
| Locked workspace sync | Passed with both workspace packages installed from their local member paths |
| Tests | `4 passed` |
| Package builds | Layline Scoring and Sailing Records each produced an sdist and wheel |

The bundle and checkout were deleted by the validation trap after the successful
run. A final fresh-bundle validation is required after this evidence is committed
so that the reviewed branch tip, rather than its documentation parent, is the
verified artifact.
