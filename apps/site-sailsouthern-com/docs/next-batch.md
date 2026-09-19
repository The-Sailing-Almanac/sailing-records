# Next-Batch Implementation Recommendation

This document outlines the concrete steps, file targets, and priorities for the next engineering sprint batch (Batch 2: Infrastructure Bootstrap).

---

## 🎯 Target Objectives

The goal of the next batch is to **bootstrap the core database schemas, storage integrations, and service containers** on `chantecler-01` or its local development equivalent. This establishes the persistent foundation before feed parsing begins.

---

## 📋 Recommended Task Breakdown

### Task 1: Repository Directory Structure Set Up
Construct the multi-service folder layout as planned in the charter:
* Create `/apps/web/` and move the current Next.js code there (to convert the repo into a clean monorepo structure).
* Create `/apps/api/` (for the Express/Node service).
* Create `/workers/` subdirectory for crawler worker modules.
* Create `/infra/docker/` for deployment configurations.

### Task 2: Docker Compose Configuration
Write `/infra/docker/docker-compose.yml` to define:
* `almanac-db` (Postgres 16, configuring volume maps and environment variables).
* `almanac-redis` (For job queue management).
* `almanac-search` (Meilisearch, with persistent volume map).
* `almanac-api` & `almanac-web` (Dev configurations).

### Task 3: Database Migrations (PostgreSQL Schema)
Write the raw SQL or migration scripts to create the initial tables:
* `source_families`
* `sources`
* `feed_endpoints`
* `article_links` (including indexes on `url_hash` and `published_at`)
* `evidence_logs`
* `rules`
* `suppression_patterns`

### Task 4: Storage & Search Configurations
* **Backblaze B2 Config**: Setup B2 S3-compatible client wrapper using the AWS S3 SDK for Node.js (`@aws-sdk/client-s3`) to handle file uploads/downloads.
* **Meilisearch client wrapper**: Setup the Meilisearch SDK client to query and sync indexes.

### Task 5: Seed Language List
* Read and import the 50 languages from `/data/languages.csv` (which the operator will drop into the `data/` directory) into a local database table or configuration map to govern the language-weighted crawl queues.

---

## 🧱 Expected Code Deliverables

1. **`infra/docker/docker-compose.yml`**
2. **`infra/db/migrations/01_initial_schema.sql`**
3. **`apps/api/src/index.ts`** (API Entry point & connection tests)
4. **`package.json`** (Updated root monorepo config, adding workspaces support)
5. **`task.md`** & **`walkthrough.md`** for Batch 2.

---

## 📌 Backlog Items (Not Batched Yet)

- **Brand tagline**: Develop a canonical publication tagline for Sail Southern / Sailing Almanac. Must be anonymous-publication-safe (no personal names, no build-diary voice). Tagline will be used in layout header, email FROM display name, social profiles, and as a publishing gate rule. Requires operator sign-off before implementation.

- **Private community platform**: First cohort uses a simple email list. Once the first ~12 founding members arrive, they vote on the channel (Discord, Slack, or classic forum). Long-term governance model: shareholder-vote-style with requests for proposals and member voting on major decisions. Founding Sponsor and Patron tiers receive steward seats. Stripe integration prerequisite.

- **Publishing gate (AI editor)**: Two-layer AI editorial gate. Architecture below. Review gate design for streamlining at **2026-12-01**.

- **CTA copy — operator approval required**: All CTA copy across the site is currently unapproved draft. No CTA copy goes live until reviewed and signed off by operator. Existing CTA instances (daily archive page support card, about page CTAs, support page) are live placeholders only. A dedicated CTA copy review session is required before any CTA sprint. See `ops/cta-copy-drafts.md` (to be created) for the review queue.

- **CTA psychology research** *(Perplexity deep dive)*: Commission a structured research brief on the psychology of voluntary contribution and donation in mission-driven organizations. Reference models: public broadcasting (NPR/PBS pledge drives), open source software (Wikipedia, curl, Linux Foundation), and religious congregation giving. Goal: inform CTA placement strategy, copy tone, frequency, and tier naming. Output should be a brief in `docs/research/cta-psychology.md`. Schedule for **2026-07-01** or after first 50 free users are active, whichever comes first.

- **CTA component sprint**: After copy is operator-approved and research brief is complete. Every public-facing page gets a subtle, low-friction CTA — no popups, no interruption. Constant ambient presence. Implementation gated on Q11/Q12 sign-off session with operator.

---

## 🚦 Publishing Gate Architecture

### Layer 1 — Article Ingest Gate
Runs during feed polling (`workers/ingest/src/feed-poller.ts`) on every ingested article.
Fast pattern-matching only (no LLM at this layer — cost and latency grounds).

Checks per article:
- Personal names blocklist (operator-configurable, stored in DB or env)
- Private repo / GitHub URLs
- Build-diary phrases ("following our journey", "hand-coded", "we built this")
- First-person meta-commentary ("as we mentioned", "our team")
- Minimum quality floor (title present, snippet ≥ 80 chars, publisher name set)

Result written to `article_links.editorial_flags` (JSONB) and `article_links.editorial_gate_status` (`pass` / `warn` / `block`).
Articles with `block` status get `is_suppressed = TRUE` automatically and fire a `block`-severity alert.
Articles with `warn` status appear in admin dashboard review queue and fire a `warn`-severity alert.

### Layer 2 — Edition Compile Gate
Runs after `scripts/compile-edition.ts` writes a `draft` edition.
New script: `scripts/gate-edition.ts`.

Steps:
1. Fetch the compiled edition's slots and assemble the rendered markdown.
2. Run LLM semantic check (see Model below) against the editorial policy ruleset.
3. Write structured audit result to `newsletter_editions.gate_status` and `newsletter_editions.gate_notes` (JSONB).
4. Decision:
   - **pass** → flip `status` to `approved`, fire `info`-severity alert (routine compile notification).
   - **warn** → flip `status` to `gate_review`, fire `warn`-severity alert (all channels). Edition holds until operator clears it via admin dashboard override endpoint.
   - **block** → leave `status` as `draft`, fire `block`-severity alert (all channels including SMS). Requires explicit operator override.
5. Gate audit log stored per edition in DB for admin dashboard surfacing.

### Gate Policy Ruleset

Rules are applied **per surface type**. The daily newsletter and blog posts have different tolerances.

#### Daily Newsletter — Hard Blocks (gate stops publish)
- Any first-person plural: "we", "our", "us", "let's"
- Any AI-generated editorial prose or narrative framing — the newsletter is **pure aggregation and presentation only**. No hooks, no sign-offs, no transitions written by AI.
- Unverified claims or speculation presented as fact
- Political content of any kind
- Technology commentary not related to sailing (mentions of "hand-coded", "Next.js", "our stack", site-building language)
- Non-sailing content
- Personal names from the operator blocklist
- Private repo / personal GitHub URLs

#### Daily Newsletter — Warnings (flag, hold for review)
- AI tell phrases (see full list below) — treat these as `block` if density is high
- Missing CTA block in rendered edition
- Article quality score below 0.4 in front-page slots (review flag, quality standards review scheduled: **2026-12-01**)

#### Blog Posts — Hard Blocks
- AI tell phrases (any occurrence — zero tolerance)
- Political content
- Technology meta-commentary about the site or its build process (unless the post is explicitly about that topic and written by operator)
- Personal names from blocklist appearing in non-editorial context

#### Blog Posts — Warnings
- Non-sailing content (warn, not block — operator-written posts may legitimately go off-topic)
- Speculation presented as fact

#### AI Tell Phrase Blocklist (stored in gate config, not hardcoded)
Zero tolerance in newsletter, zero tolerance in blog posts:
`delve`, `delves into`, `it's worth noting`, `as an AI`, `I should note`,
`fascinating`, `let's explore`, `comprehensive overview`, `in conclusion`,
`to summarize`, `in summary`, `certainly`, `absolutely`, `undoubtedly`,
`deep dive`, `dive deep`, `leverage` (as non-financial verb), `robust`,
`cutting-edge`, `state-of-the-art`, `seamlessly`, `holistic`, `paradigm`,
`I'd be happy`, `of course`, `rest assured`, `I hope this`, `please note`,
`it is important to note`, `as mentioned`

#### First-Person Rule Summary
| Surface         | "we/our/us" | AI editorial prose |
|-----------------|-------------|-------------------|
| Daily newsletter | BLOCK       | BLOCK             |
| Blog post        | allowed     | BLOCK             |

### Model
**Decided: Claude API (`claude-sonnet-4-6`)** for Layer 2 semantic checks. Layer 1 is pure pattern matching — no LLM. Claude is a second AI provider alongside Gemini, providing redundancy hedge. If Gemini has outages, other pipeline tasks can shift to Claude API as well. Requires `ANTHROPIC_API_KEY` env var.

### Notification Routing by Severity
| Severity | Telegram | Discord | Slack | ntfy | Email | SMS |
|----------|----------|---------|-------|------|-------|-----|
| info     | ✓        | ✓       | ✓     | ✓    | ✓     | —   |
| warn     | ✓        | ✓       | ✓     | ✓    | ✓     | ✓   |
| block    | ✓        | ✓       | ✓     | ✓    | ✓     | ✓   |

### New DB Columns Required
Migration needed before gate build:
```sql
ALTER TABLE article_links
  ADD COLUMN editorial_gate_status TEXT DEFAULT 'pass',
  ADD COLUMN editorial_flags JSONB;

ALTER TABLE newsletter_editions
  ADD COLUMN gate_status TEXT DEFAULT 'pending',
  ADD COLUMN gate_notes JSONB;
```

### Audit Log
Every gate run writes a `GateAuditLog` JSONB to `newsletter_editions.gate_notes`. Structure is fully typed in `scripts/gate-edition.ts`. Surfaced in admin dashboard under a new Gate tab. Fields include: check-by-check results with exact evidence excerpts, LLM token usage (including cache hits), processing time, model version, recommended action, and full summary. Edition-level history is permanent and never overwritten.

### Known Technical Debt to Fix During Gate Sprint
- ~~`workers/ingest/src/newsletter-generator.ts`~~ **Retired** (2026-05-31) — renamed to `newsletter-generator.retired.ts`. Superseded by `compile-edition.ts`. Gate bypass is closed.
- `scripts/compile-edition.ts` has an inline `notify()` that only hits `MONITORING_WEBHOOK_URL`. Replace with `broadcastAlert()` during gate integration.
- Two identical `notifications.ts` files (`apps/api/src/lib/` and `workers/ingest/src/lib/`). Should be consolidated into a shared package at next opportunity.
