# Sprint Handoff — Phase 6: STAX Commander Alignment
# Sail Southern Publishing Infrastructure

**Date:** 2026-05-29  
**Operator:** Alan Woodyard  
**Batch:** `ss-cleanup-humanize-phase-6-stax-commander-alignment`  
**Status:** ✅ Complete

---

## What Was Done

### 1. Dashboard shell refactored

`apps/web/src/app/admin/page.tsx` was an 800-line monolith with all surfaces inlined. It is now a **routing shell** (~270 lines) that delegates to focused surface components. The page defaults to the **Readiness** tab so the operator lands on a clear "can we safely publish?" answer every time they open the dashboard.

### 2. STAX Commander primitives created

New `commander/` directory with 5 generic components:

- **SectionShell** — titled card wrapper used by all surfaces
- **StatusCard** — numeric/textual stat display
- **ReadinessCard** — traffic-light readiness with remediation copy
- **RunRow** — expandable run row with retry action
- **ActionBar** — action button with confirm modal and inline result

These have no SS-specific logic and are ready to graduate to a `packages/commander-ui/` package.

### 3. New domain surfaces

6 new purpose-built surface files in `surfaces/`:

| Surface | Key features |
|---------|-------------|
| `ReadinessSurface` | "Can we safely publish?" — ReadinessCard per integration, remediation copy |
| `SchedulerSurface` | BullMQ queue depth, next run, force-publish, Wayback queue status |
| `PublishingRunsSurface` | Run history with expandable detail, platform outcomes, retry |
| `SocialDeliverySurface` | Post archive, platform badges, archive status, failed delivery retry |
| `ArchiveBackfillSurface` | Archive mode badge, backlog count, batch trigger, retry failed |
| `AnalyticsSurface` | GA4 readiness, reconciliation table, mismatch detail |

### 4. New API endpoints (6)

All in `apps/api/src/routes/v1.ts`:

- `POST /social/deliveries/:id/retry` — re-queue a failed social delivery
- `POST /social/runs/:id/retry` — create a new run as retry of a failed one
- `POST /social/captures/retry-failed` — re-enqueue up to 50 failed Wayback captures
- `POST /social/publish-now` — force-trigger a micro-edition publish immediately
- `GET  /system/readiness` — integration readiness matrix
- `GET  /system/scheduler` — BullMQ scheduler + wayback queue state + recent runs

### 5. Script humanization

`scripts/generate-micro-edition.ts` now outputs:

- Sectioned headers with `─` dividers
- `[LIVE]` or `[DRY RUN — no changes will be made]` mode badge at start
- ✅ / ⚠️ / ❌ prefixed lines for outcomes
- Actionable remediation hints on every failure (specific .env variable names)

### 6. Architecture documentation

- `docs/architecture/stax-commander-integration.md` — maps every surface, endpoint, and primitive to STAX-shared vs SS-local with graduation criteria
- This handoff document

---

## Tests

All 74 API tests still pass (`npm test --workspace=almanac-api`).

---

## Tab Map (before → after)

| Before | After | Type |
|--------|-------|------|
| overview | Overview | Existing |
| content | Content | Existing |
| submissions | Submissions | Existing |
| social | Publishing runs | Refactored into own surface |
| social | Social posts | Refactored into own surface |
| *(social)* | Archive | Extracted |
| analytics | Analytics | Refactored into surface |
| supporters | Supporters | Existing |
| *(new)* | Readiness 🚦 | **NEW — default tab** |
| *(new)* | Scheduler ⏰ | **NEW** |

---

## What Remains for Phase 7

1. Surface `live_ingest` + `archival_backfill` queue depths in Scheduler
2. Extract `printSection/printOk/printFail` helper to `scripts/lib/print.ts`
3. Graduate `commander/` primitives to `packages/commander-ui/` when a second domain is confirmed
4. Add ActivityPub outbound queue state to SchedulerSurface
5. Humanize `generate-daily-newsletter.ts` CLI output (same pattern)
6. Add `trigger_source` display to RunRow (API already returns it)
