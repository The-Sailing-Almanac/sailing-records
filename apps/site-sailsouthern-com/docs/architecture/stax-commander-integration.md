# STAX Commander Integration Note
# Sail Southern — Phase 6 Commander Alignment

**Last updated:** 2026-05-29  
**Batch:** `ss-cleanup-humanize-phase-6-stax-commander-alignment`

---

## Purpose

This document maps every dashboard surface, API endpoint, and shared primitive to its STAX-layer classification:

- **STAX-shared (Bucket 1):** Generic — usable in any STAX domain without modification
- **SS-local (Bucket 2):** Sail Southern-specific — implements SS workflows using STAX primitives

This is the contract document for graduating SS-local code to STAX-shared once a second domain (e.g., stax-compass, sailing-almanac) demonstrates the same need.

---

## Commander Primitives (STAX-shared)

These live in `apps/web/src/app/admin/commander/` and have no domain-specific logic.

| File | Purpose | Graduation status |
|------|---------|-------------------|
| `SectionShell.tsx` | Titled card wrapper with badge + actions slot | ✅ Ready to graduate |
| `StatusCard.tsx` | Numeric/textual stat card | ✅ Ready to graduate |
| `ReadinessCard.tsx` | Traffic-light readiness card with remediation copy | ✅ Ready to graduate |
| `RunRow.tsx` | Expandable run row with outcome badge and retry | ✅ Ready to graduate |
| `ActionBar.tsx` | Action button with confirm modal and result banner | ✅ Ready to graduate |

**Interface contracts:**
- All props are typed via exported `*Props` interfaces
- Components use only CSS custom properties — no hardcoded colors
- No imports from outside the `commander/` directory except React and lucide-react

**To graduate:** Move `apps/web/src/app/admin/commander/` → a new `packages/commander-ui/` package, add `index.ts` re-exports, and update all imports.

---

## Domain Surfaces (SS-local)

These live in `apps/web/src/app/admin/surfaces/` and implement Sail Southern workflows.

| Surface | STAX primitives used | SS-specific logic |
|---------|---------------------|-------------------|
| `ReadinessSurface.tsx` | ReadinessCard, StatusCard, SectionShell | SS env vars, integration names, why-it-matters copy |
| `SchedulerSurface.tsx` | SectionShell, StatusCard, RunRow, ActionBar | `social-scheduler` queue, `micro-edition-publish` job, `QueueCard` (SS-local inline) |
| `PublishingRunsSurface.tsx` | SectionShell, StatusCard, RunRow | SS run schema, retry endpoint |
| `SocialDeliverySurface.tsx` | SectionShell, ActionBar | SS platform list, delivery retry, archive capture badges |
| `ArchiveBackfillSurface.tsx` | SectionShell, StatusCard, ActionBar | Wayback SPN, auth_mode, backfill endpoint |
| `AnalyticsSurface.tsx` | SectionShell, ReadinessCard, StatusCard | GA4 Measurement Protocol readiness, reconciliation |

### Queue health cards (SS-local inline component)

`QueueCard` is currently inlined in `SchedulerSurface.tsx`. It renders per-queue metrics (waiting/active/failed/oldest job age) and a health badge.

**Graduation criteria:** When a second STAX domain wants queue visibility, extract `QueueCard` to `apps/web/src/app/admin/commander/QueueCard.tsx` and parameterize the health thresholds.

**Health thresholds (current):**
- `stalled` → oldest waiting job > 1 hour
- `degraded` → `failed_recent` count > 10
- `healthy` → all other states

**Graduation criteria for any surface:**  
A surface graduates when 2+ STAX domains have the same surface need and the domain-specific copy is parameterized. At that point, extract to `packages/commander-ui/surfaces/`.

---

## API Endpoints

### STAX-aligned system endpoints (graduate as `/stax/system/*`)

| Method | Path | Classification | Ready to graduate? |
|--------|------|---------------|-------------------|
| `GET` | `/api/v1/system/readiness` | STAX-shared logic, SS env vars | When env vars are parameterized |
| `GET` | `/api/v1/system/scheduler` | STAX-shared logic (BullMQ) | ✅ Nearly generic — just queue names |

### SS-local action endpoints (stay domain-local)

| Method | Path | Classification |
|--------|------|---------------|
| `POST` | `/api/v1/social/deliveries/:id/retry` | SS-local |
| `POST` | `/api/v1/social/runs/:id/retry` | SS-local |
| `POST` | `/api/v1/social/captures/retry-failed` | SS-local |
| `POST` | `/api/v1/social/publish-now` | SS-local |

---

## BullMQ Queues

| Queue | Role | Dashboard visibility |
|-------|------|---------------------|
| `social-scheduler` | Triggers `micro-edition-publish` on cron | ✅ SchedulerSurface — queue card + health badge |
| `wayback-spn` | Archives published post URLs | ✅ SchedulerSurface — queue card + health badge |
| `entity_extraction` | Enriches raw article links | ✅ SchedulerSurface — queue card + health badge |
| `feed_validation` | Validates and scores raw feed entries | ✅ SchedulerSurface — queue card + health badge |
| `activitypub-outbound` | Delivers ActivityPub activities | ✅ SchedulerSurface — queue card + health badge |
| `rig-scrape` / `yachtworld-scrape` | Sailboat data scraping | Not yet surfaced in dashboard |

**Commander stance:** All BullMQ queues are operational objects that belong in the commander. `rig-scrape` and `yachtworld-scrape` should be added when the sailboat data pipeline is active.

---

## Humanization Vocabulary

This vocabulary is SS-local today. If a second domain adopts it verbatim, consider promoting to a shared `i18n/operator-terms.ts`.

| DB / code term | Operator-facing label |
|---------------|----------------------|
| `social_publishing_runs` | Publishing runs |
| `micro_edition_publish` | Micro-edition |
| `run_status: running` | Publishing in progress |
| `run_status: success` | Published |
| `run_status: failed` | Failed to publish |
| `social_post_deliveries` | Social posts |
| `social_post_captures` | Archive captures |
| `auth_mode: authenticated` | Authenticated archive |
| `auth_mode: anonymous` | Unauthenticated archive |
| `pending_capture_count` | Awaiting archive |
| `reconciliation` | Analytics sync |
| `CRAWL_EXPANSION_ENABLED` | Auto-scan |
| `social_delivery failure` | Post did not publish |
| `trigger_source: scheduler` | Scheduled (gray badge) |
| `trigger_source: manual` | Manual (amber badge) |
| `trigger_source: api` | API (red badge) |
| queue `health: stalled` | Stalled — oldest job > 1 hour |
| queue `health: degraded` | Degraded — > 10 failures |

---

## CLI Script Language

Script outputs now use the shared `scripts/lib/print.ts` helper (exported: `printSection`, `printOk`, `printWarn`, `printFail`, `printFixHint`, `printBadge`, `printSummary`).

Both `generate-micro-edition.ts` and `generate-daily-newsletter.ts` import from this shared module. Any future script should do the same.

---

## Open Items for Phase 8

1. ~~Surface `live_ingest` and `archival_backfill` queue depths~~ ✅ Done (as `entity_extraction` / `feed_validation`)
2. ~~Extract `printSection / printOk / printWarn / printFail` to `scripts/lib/print.ts`~~ ✅ Done
3. Graduate `commander/` primitives to `packages/commander-ui/` package once a second domain is confirmed
4. Graduate `QueueCard` from inline in SchedulerSurface to `commander/QueueCard.tsx` when a second domain needs queue monitoring
5. Time-window `failed_recent` queue count to true last-24h (currently returns total BullMQ failed count)
6. Add queue health summary to `GET /system/readiness` so ReadinessSurface shows it
7. Add `trigger_source: 'api'` to any external webhook endpoint
8. Apply `lib/print` helpers to remaining operational scripts (`backfill-wayback-captures.ts`, etc.)
9. Add `rig-scrape` / `yachtworld-scrape` queue cards when sailboat data pipeline is active
