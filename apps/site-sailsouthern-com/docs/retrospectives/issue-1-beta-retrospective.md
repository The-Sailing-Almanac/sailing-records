# Issue 1 Beta Retrospective

## Technical Debt & Infrastructure Blockers
1. **Infrastructure Service Dependency:** The compilation and dry-run scripts require a live connection to PostgreSQL to query candidates. Without local DB services running, even basic compilation testing is blocked.
2. **Redis Integration for Vitest:** The pre-existing test suite contains a Redis dependency that fails when Redis is down. A mock-based fallback would make testing more resilient.

## Lessons Learned
- **Decoupled Dry Runs:** Future scripts should allow fully mocked dry runs (using local JSON fixtures instead of live DB queries) to allow offline UI/UX validation when DB servers are down.
- **Service Status Checks:** Early, automated checks in the codebase/scripts for service availability would give operators clearer feedback than raw `ECONNREFUSED` stack traces.
