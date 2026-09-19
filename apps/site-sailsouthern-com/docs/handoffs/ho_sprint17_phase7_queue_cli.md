# Sprint Handoff — Phase 7: Queue Visibility & CLI Alignment
# Sail Southern Publishing Infrastructure

**Date:** 2026-05-29  
**Operator:** Alan Woodyard  
**Batch:** `ss-phase-7-queue-visibility-and-cli-alignment`  
**Status:** ✅ Complete

---

## What Was Done

### 1. Queue Visibility — Scheduler tab

**API:** `GET /api/v1/system/scheduler` expanded to return a `queues[]` array with metrics for all 5 BullMQ workers:

| Queue name | Label |
|-----------|-------|
| `social-scheduler` | Social scheduler |
| `wayback-spn` | Wayback archive |
| `entity_extraction` | Entity extraction |
| `feed_validation` | Feed validation |
| `activitypub-outbound` | ActivityPub outbound |

Each queue entry includes: `waiting`, `active`, `completed_recent`, `failed_recent`, `oldest_waiting_ms`, `health` (`healthy` / `degraded` / `stalled`).

Health logic:
- **Stalled** → oldest waiting job > 1 hour
- **Degraded** → more than 10 failures in queue
- **Healthy** → all other states

**UI:** `SchedulerSurface.tsx` now has a full "Queue health" section showing a `QueueCard` per queue. Cards show inline remediation hints for stalled/degraded queues, and a global "Queues needing attention" stat card if any are unhealthy.

> **Note on queue names:** Batch spec used `live_ingest` and `archival_backfill` — these names don't exist in the codebase. Actual ingest workers use `entity_extraction` and `feed_validation`. This was corrected.

### 2. CLI Alignment

**New file:** [`scripts/lib/print.ts`](../../scripts/lib/print.ts) — shared formatting helpers used by all scripts:
- `printSection(title, modeBadge?)` — divider + title + optional [LIVE]/[DRY RUN] badge
- `printOk(msg)` — ✅ line
- `printWarn(msg)` — ⚠️ line  
- `printFail(msg, hint?)` — ❌ line with → remediation
- `printFixHint(hint)` — standalone remediation line
- `printBadge(text, type)` — mode badge
- `printSummary(counts)` — end-of-run count block

**`generate-daily-newsletter.ts`** — complete humanization:
- 5 structured sections: Configuration check / Content ingestion / AI generation / Save & federate / Email broadcast
- `--dry-run` now properly generates content and previews output (previously just exited on line 27)
- `--date` / retroactive mode properly labeled in output
- Fix hints on every failure path with exact `.env` variable names
- `printSummary` at end of each run

**`generate-micro-edition.ts`** — refactored to import from `lib/print` instead of its inline helper block (identical behavior, shared source).

### 3. Trigger Source Badge

**Migration:** `infra/db/migrations/029_add_trigger_source.sql` — adds `trigger_source TEXT DEFAULT 'scheduler'` to `social_publishing_runs`.

**`RunRow.tsx`** — trigger source upgraded from plain `"via Scheduled"` text to colored pill badge:
- `scheduler` → gray badge — Scheduled
- `manual` → amber badge — Manual  
- `api` → red badge — API

### 4. Documentation

STAX integration doc updated with:
- Queue visibility section classified as SS-local (queue names are SS-specific)
- Graduation criteria: once a second domain needs the same pattern, extract `QueueCard` to `commander/`

---

## Verification

- **74/74 API tests** pass
- **TypeScript** — `apps/web` and `apps/api` both compile with zero errors
- `scripts/lib/print.ts` exports verified by usage in two scripts

---

## Open for Phase 8

1. Apply `lib/print` helpers to remaining operational scripts (backfill-wayback-captures.ts, etc.)
2. Add queue job count to `GET /system/readiness` so ReadinessSurface can also show a queue health summary
3. Graduate `QueueCard` component to `commander/` when a second domain adopts queue monitoring
4. Add `trigger_source: 'api'` support to external API webhook endpoint (if built)
5. Time-window the `failed_recent` count to true "last 24h" (currently returns total queue failed count from BullMQ)
