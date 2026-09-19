# Operationalization Phase 4 Handoff Memo

**Date:** 2026-05-29  
**Operator:** Antigravity (AI Pair Programmer)  
**Role:** Planning / PM  
**Sprint:** `sailsouthern-operationalization-phase-4`  

---

## 1. Production Scheduling Cadence

The micro-edition daily compilation and publishing system has been moved from manual curating to an automated production scheduler.

- **Orchestration Layer**: BullMQ Repeatable Jobs.
- **Configured Cadence**: Triggered daily at **8:00 AM** in **New York** timezone.
- **Configuration Keys** (configured in `.env`):
  - `PUBLISH_CRON_PATTERN`: Defaults to `0 8 * * *` (8:00 AM daily).
  - `PUBLISH_TIMEZONE`: Defaults to `America/New_York`.
- **Implementation Location**: [scheduler.ts](file:///c:/Users/aewoo/.projects/repos/ss-sailsouthern-com/workers/federation/src/scheduler.ts) (wired into [index.ts](file:///c:/Users/aewoo/.projects/repos/ss-sailsouthern-com/workers/federation/src/index.ts)).
- **Mechanism**: The daemon clears any existing repeatable scheduler jobs on boot and registers a new repeatable job. When the job fires, it inserts a new run log with `running` status, obtains the `runId`, and spawns the compilation process via a child process `npx tsx scripts/generate-micro-edition.ts --run-id <runId>`. This guarantees process isolation and database connection hygiene.

---

## 2. Run-State Tracking & Visibility

Every scheduled publishing run is tracked to ensure full observability.

- **Durable Logging Table**: `social_publishing_runs` (created in migration [027_social_publishing_runs.sql](file:///c:/Users/aewoo/.projects/repos/ss-sailsouthern-com/infra/db/migrations/027_social_publishing_runs.sql)).
- **Monitored Fields**:
  - `job_name` (e.g. `micro_edition_publish`)
  - `run_status` (`running`, `success`, or `failed`)
  - `started_at`, `completed_at`
  - `duration_ms`
  - `summary_counts` (`JSONB` containing counts of deliveries, failures, or skipping reasons)
  - `error_message` (stores full exception text if the run fails)
- **API Visibility**: Exposes `GET /api/v1/social/runs` under admin authorization, returning recent runs and the calculated details of the next scheduled run.
- **Dashboard UI Panel**: Added the **Social Publishing Schedule & Run History** sub-panel to the "Social" tab in the admin dashboard page. This card displays the next scheduled execution, cron details, and a tabular log history of recent execution runs.

---

## 3. Server-Side GA4 Event Instrumentation

The publishing pipeline has been instrumented using the server-side **GA4 Measurement Protocol** to link outbound publication steps with downstream traffic outcomes.

- **Helper Client**: `sendGA4Event(eventName, params)` implemented in [@stax/activity-core](file:///c:/Users/aewoo/.projects/repos/ss-sailsouthern-com/packages/activity-core/src/ga4.ts) and exported in `index.ts`. It cleans parameter structures (forcing string/number/boolean values) and makes POST requests to:
  `https://www.google-analytics.com/mp/collect?measurement_id=<ID>&api_secret=<SECRET>`
- **Wired Events & Firing Points**:
  1. `micro_edition_generated`: Fires in `scripts/generate-micro-edition.ts` after Gemini returns successfully parsed JSON content. Parameters: `title`, `article_count`, `key_links_count`.
  2. `social_delivery_success`: Fires in `scripts/generate-micro-edition.ts` after successful Mastodon, Nostr, or Bluesky adapter dispatch. Parameters: `platform`, `post_id`, `external_id`.
  3. `social_delivery_failure`: Fires in `scripts/generate-micro-edition.ts` if an adapter dispatch fails. Parameters: `platform`, `error_message`.
  4. `micro_edition_published`: Fires in `scripts/generate-micro-edition.ts` at the end of the publishing flow. Parameters: `deliveries`, `failures`, `reason` (e.g. `dry_run` or `no_articles`).
  5. `social_capture_success`: Fires in `workers/federation/src/wayback-spn.ts` when a Wayback SPN capture is completed. Parameters: `post_id`, `delivery_id`, `archive_url`.
  6. `social_capture_failure`: Fires in `workers/federation/src/wayback-spn.ts` when Wayback SPN fails. Parameters: `post_id`, `delivery_id`, `error_message`.
  7. `social_metrics_snapshot`: Fires hourly in `workers/federation/src/metrics-worker.ts` for each delivery. Parameters: `platform`, `post_id`, `delivery_id`, `likes`, `shares`, `replies`.
  8. `newsletter_publish_started`: Fires in `scripts/generate-daily-newsletter.ts` when the daily email compile job initiates. Parameters: `target_date`.
  9. `newsletter_publish_completed`: Fires in `scripts/generate-daily-newsletter.ts` after daily email broadcast completes or fails. Parameters: `status`, `title`, `subscribers_sent`, `articles_count`.

---

## 4. Reconciled Metrics & Dashboard Cards

Admin controls can reconcile database post history with live traffic signals using the Google Analytics Data API.

- **API Endpoint**: `GET /api/v1/social/reconciliation` (under admin auth).
  - Fetches the current **Real-Time Active Users** count from GA4 using the Google Analytics Data API (`runRealtimeReport`).
  - Aggregates internal database outcomes: total posts, successful deliveries, failed deliveries, delivery success rate, completed captures, failed captures, capture success rate.
- **Dashboard UI Panel**: Added the **Pipeline Health & Outcomes** section to the "Analytics" tab in the admin dashboard:
  - **Realtime Active Users Card**: Sourced directly from GA4.
  - **Delivery Success Rate Card**: Sourced from DB deliveries.
  - **Capture Success Rate Card**: Sourced from Wayback capture records.

---

## 5. Environment Variables & Setup

Hardening GA4 server-side events and Data API reconciliation requires adding the following configuration parameters to your `.env` file:

```bash
# GA4 Server-Side Measurement Protocol
GA4_MEASUREMENT_ID=G-XXXXXXXXXX
GA4_API_SECRET=your_api_secret_key_from_google_analytics

# GA4 Data API (for dashboard metrics reconciliation)
GA4_PROPERTY_ID=your_ga4_property_id
GA4_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GA4_PRIVATE_KEY="${GA4_PRIVATE_KEY}"

# Scheduled Publishing
PUBLISH_CRON_PATTERN="0 8 * * *"
PUBLISH_TIMEZONE="America/New_York"
```

If these keys are missing or unconfigured:
- GA4 Measurement Protocol requests are gracefully skipped, printing a warning log.
- Real-time GA4 metrics default to `0` without causing endpoint failures.

---

## 6. Recommended Test Plan

To verify operations and schedule components in the staging/production environment:

### 1. Run unit test suite
Ensure all 74 unit tests compile and pass:
```bash
npm test --workspace=almanac-api
```

### 2. Manual Dry Run Trigger
Trigger the micro-edition publication flow manually in dry-run mode to verify Gemini content generation, rendering logic, and GA4 events:
```bash
npx tsx scripts/generate-micro-edition.ts --dry-run
```

### 3. Verify Database Run History logging
Verify that run history entries are written to the database table:
```bash
npx tsx scratch/check-runs.ts
```

### 4. Scheduler Tick Verification
Test immediate worker execution using your BullMQ scheduling worker or verify by monitoring the output logs when the scheduler triggers at the configured daily time.
