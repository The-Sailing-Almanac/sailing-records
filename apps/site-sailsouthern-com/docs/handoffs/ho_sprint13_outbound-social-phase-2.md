# Sailing Almanac – Outbound Social Archive Phase 2 Sprint Handoff Memo

**Date:** 2026-05-29  
**Operator:** Antigravity (AI Pair Programmer)  
**Sprint Name:** `sailsouthern-outbound-social-phase-2`  

---

## 1. Executive Summary
This sprint completes the implementation of the **Outbound Social Archive Phase 2** pipeline, establishing a robust, multi-rail social publishing system (Mastodon, Nostr, and Bluesky/ATProto) alongside automated capture archiving, hourly engagement metrics tracking, identity metadata updates, and social page intake registry configurations.

---

## 2. Completed Deliverables

### A. Core Architecture & Renderers
- **`packages/activity-core/src/social-archive.ts`**:
  - Defined the shared `CanonicalMicroNewsletter` interface model.
  - Implemented channel-specific renderer functions:
    - `renderMastodon`: Generates text and plain URLs, capping at 500 characters.
    - `renderNostr`: Generates Kind-1 content text and extracts hashtag tags.
    - `renderBluesky`: Generates concise text and main link, capping at 300 characters.

### B. Production Social Adapters
- **`scripts/lib/social-adapters.ts`**:
  - Upgraded the Bluesky adapter using the `@atproto/api` `BskyAgent` client.
  - Enabled rich-text facet detection for clickable links and tags.
  - Added support for media blob uploads to ATProto.
  - Wired all three platform adapters (Mastodon, Nostr, Bluesky) to write to `social_posts` and `social_post_deliveries` at creation/publishing time.

### C. Background Workers (`@sailsouthern/federation-worker`)
- **`workers/federation/src/wayback-spn.ts`**:
  - Extended the worker callback to parse `postId` and `deliveryId`.
  - Saves completed and failed capture states directly to `social_post_captures`.
  - Added a 5-minute periodic scanning loop that polls the database for successful deliveries missing a Wayback capture and enqueues SPN capture jobs.
- **`workers/federation/src/metrics-worker.ts`**:
  - Implements an hourly daemon loop querying deliveries from the last 7 days.
  - Polls Mastodon and Bluesky APIs for likes, shares, and replies, appending time-series records to `social_post_metrics_snapshots`.
  - Incorporates rate-limiting delays between requests.

### D. API & Admin Dashboard Extensions
- **`apps/api/src/routes/v1.ts`**:
  - Extended GET `/social/posts` to fetch and attach Wayback archive status and the latest metrics snapshot for all deliveries via a subquery.
  - Extended GET `/social/posts/:id` to retrieve full historical captures and engagement records.
- **`apps/web/src/app/admin/page.tsx`**:
  - Upgraded the React admin dashboard "social" tab to display real-time capture status badges (`Wayback Archived`, `Pending`, `Failed`) and cumulative metrics counts (likes, shares, replies).

### E. Micro-Newsletter & Identity Generators
- **`scripts/generate-micro-edition.ts`**:
  - CLI script retrieving top recent sailing articles, querying Gemini (`gemini-2.5-flash`) for a structured JSON micro-newsletter summary, formatting it for each platform, executing the adapters, and recording the archival writes.
- **`scripts/update-nostr-profile.ts`**:
  - Script loading identity parameters (`LIGHTNING_ADDRESS`, `BOLT12_OFFER`) and profile fields, generating and signing a Kind-0 metadata event, and broadcasting it to configured relays.

---

## 3. Database Updates

A new schema migration was applied successfully:
* **`infra/db/migrations/026_social_intake_registry.sql`**:
  - Created the `social_intake_sources` table tracking `platform`, `source_url`, `ingestion_method`, `status`, `last_success`, and `last_error`.
  - Created indices on `platform` and `status` to optimize ingestion runs.

---

## 4. Verification & Testing

- **Renderer Unit Tests**:
  - Created `apps/api/src/__tests__/micro-newsletter.test.ts` to test renderer outputs, limits, and truncation rules.
  - Ran and verified: `npx vitest run apps/api/src/__tests__/micro-newsletter.test.ts` (Passed).
- **Social Adapters Integration Tests**:
  - Ran and verified: `npx vitest run apps/api/src/__tests__/social-adapters.test.ts` (Passed).
- **Generation Output Validation**:
  - Executed `npm run micro-edition -- --dry-run` to confirm the AI-generated JSON format and render pipeline outputs.
