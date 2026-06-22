# SAFE TASKS

## Tier 1 — Low risk, AI may execute independently
Use for changes that do not alter architecture, security posture, or production behavior.

Examples:
- README improvements
- grammar, spelling, and wording fixes
- link repairs
- comments and docstrings
- non-sensitive JSON/YAML content edits
- test fixtures and new tests for existing behavior
- small logging additions in non-critical paths
- local refactors with no behavioral change

Required handling:
- narrow diff
- plain-English explanation
- no dependency changes
- no protected path edits unless explicitly allowed

## Tier 2 — Moderate risk, AI may implement but human review is mandatory
Use for useful work that can affect behavior, but remains bounded and reversible.

Examples:
- bug fixes in non-critical code paths
- UI fixes
- helper utilities
- build configuration adjustments
- telemetry additions
- validation improvements
- import cleanup with test updates
- non-breaking refactors

Required handling:
- human review before merge
- tests run or updated
- rollback path clear
- no hidden scope creep

## Tier 3 — High risk, humans decide; AI assists only
Use for changes with security, data, lifecycle, or architectural blast radius.

Examples:
- authentication changes
- secrets handling
- database schema or migration work
- dependency upgrades with compatibility impact
- production deployment changes
- large deletions, restructures, or repo merges
- lifecycle changes such as deprecating or archiving a repo
- budget policy or branch protection changes

Required handling:
- stop implementation until explicitly approved
- open an issue or design note first
- require review, tests, and rollback planning
