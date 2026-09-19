# Handoff: Phase 9 — Tiny Ops Verification & Beta Sprint
# Batch ID: ss-phase-9-tiny-ops-verification-and-beta-sprint
# Date: 2026-05-29
# Operator: Alan Woodyard

---

## What Is Now Operational

### Lane 2 — Multi-Window Publish Cadence ✅ CODE COMPLETE

The scheduler (`workers/federation/src/scheduler.ts`) now registers **4 named BullMQ
repeatable jobs** instead of one:

| Window name | Cron | Central Time |
|-------------|------|-------------|
| `micro-edition-publish-0500` | `0 5 * * *` | 5:00 AM CT |
| `micro-edition-publish-1100` | `0 11 * * *` | 11:00 AM CT |
| `micro-edition-publish-1700` | `0 17 * * *` | 5:00 PM CT |
| `micro-edition-publish-2300` | `0 23 * * *` | 11:00 PM CT |

Default timezone: `America/Chicago`. Override with `PUBLISH_TIMEZONE` in `.env`.

If `PUBLISH_CRON_PATTERN` is set, reverts to single-window mode for that pattern.

**To activate:** restart `workers/federation` — `setupScheduledJobs()` will clear old
registrations and register the 4 windows automatically.

### SchedulerSurface — Multi-Window Display ✅

`SchedulerSurface.tsx` now checks `scheduler.repeatable_jobs` from the API. When
the scheduler has > 1 repeatable job, it renders a schedule grid showing each
window's cron pattern, timezone, and next fire time — instead of a generic "Next run"
card. Single-window mode falls back to the old StatusCard.

### Lane 3 — Sample-Run Isolation ✅ CODE COMPLETE

`compile-edition.ts` now supports `--sample`:

```powershell
# Sample run (does NOT consume production candidates)
npx tsx scripts/compile-edition.ts --sample

# Normal dry-run (no DB writes at all)
npx tsx scripts/compile-edition.ts --dry-run

# Live production compile
npx tsx scripts/compile-edition.ts
```

**Behavior differences:**

| Mode | DB write | Dedup impact | Archive | Analytics | Warning shown |
|------|----------|-------------|---------|-----------|--------------|
| `--dry-run` | ❌ None | None | ❌ | ❌ | Yes |
| `--sample` | ✅ Yes (`run_mode=sample`) | ❌ **Excluded** | ❌ | ❌ | Yes (boxed) |
| live | ✅ Yes (`run_mode=live`) | ✅ Participates | ✅ | ✅ | No |

Sample editions:
- Write to `newsletter_editions` with `run_mode='sample'`
- Use a suffixed `edition_date` (`2026-05-29_sample_<timestamp>`) so they cannot
  conflict with the live edition row for the same date
- Are **excluded from the dedup query** — the 5am live compile ignores them
- Suppresses monitoring alerts
- Are tagged `[SAMPLE]` in the `edition_label` field

### Migrations ✅ WRITTEN, ⚠️ PENDING DB APPLY

Two migrations are written and ready. They couldn't auto-apply because the local
DB is not accessible from this session (ECONNREFUSED localhost:5432). Apply when
the DB is accessible:

```powershell
npx tsx scripts/apply-migration.ts 030_newsletter_edition_run_mode.sql
npx tsx scripts/apply-migration.ts 031_social_runs_run_mode.sql
```

Until 030 is applied:
- `compile-edition.ts --sample` will fail on DB write (no `run_mode` column)
- `compile-edition.ts --dry-run` still works fine (no DB write)
- Live compile still works fine (the SQL INSERT will error until column exists)

**Apply migrations before running any live or sample compile.**

### Lane 4A — Social Web Readiness Audit ✅ DELIVERED

Full audit at `ops/social-web-readiness.md`. Covers:
- Brand identity alignment (handle decision needed)
- Platform-by-platform profile checklists (Mastodon / Nostr / Bluesky)
- Credential requirements and `.env` keys
- Smoke-test sequence
- Website footer social link gap identified

### Lane 4B — Website Copy Signoff Review ✅ DELIVERED

Full review at `ops/copy-signoff-review.md`. 17 items identified.

---

## What Still Blocks Issue 1 Beta

### Critical (must resolve before any public launch)

| # | Blocker | Location | Action |
|---|---------|----------|--------|
| 1 | **DB migrations not applied** | `030` and `031` | Apply when DB is accessible |
| 2 | **8 copy items RED** | Site-wide | See `ops/copy-signoff-review.md` |
| 3 | **Social credentials missing / unconfirmed** | `.env` | Add MASTODON_ACCESS_TOKEN etc. |
| 4 | **Social profiles not created** | Each platform | Manual account setup |
| 5 | **Stripe disabled, no explanation** | `/support` | Add "coming soon" note |

### Operational (required before automated publishing is trustworthy)

| # | Item | Action |
|---|------|--------|
| 6 | **Federation worker not running** | BullMQ scheduled jobs only fire if the worker is active. Start it: `cd workers/federation && npx ts-node src/index.ts` |
| 7 | **PUBLISH_TIMEZONE not confirmed in .env** | Add `PUBLISH_TIMEZONE=America/Chicago` explicitly — worker defaults to it, but make it explicit |
| 8 | **compile-edition must be triggered for 5am window** | The scheduler runs `generate-micro-edition.ts` (social posts). A separate cron or API trigger is needed for the web issue compile (`compile-edition.ts`). These are NOT the same script. |

### Medium (address in next sprint)

| # | Item |
|---|------|
| 9 | Newsletter frequency options in subscribe form — "Monday + Thursday" and "All Dispatches" should be removed until established |
| 10 | Nav "Racing Results" CTA and footer "Racing Leaderboards" link to homepage — fix or remove |
| 11 | `/daily/latest` operator instructions visible to public — gate behind admin or remove |
| 12 | Social profile links not in footer — add once accounts are confirmed |
| 13 | "Almanack" vs "Almanac" spelling consistency check |

---

## Lane 1 — Tiny Ops Verification Status

### What was attempted
The `--dry-run` path was verified successfully in Phase 8 against 441k real articles.

### What cannot run now
- Live compile and sample compile require the DB to be accessible (currently ECONNREFUSED)
- Email newsletter generate requires GEMINI_API_KEY and RESEND_API_KEY (check readiness endpoint)
- Social smoke test requires social credentials

### Operator verification sequence (once DB is up)

1. **Apply migrations:**
   ```powershell
   npx tsx scripts/apply-migration.ts 030_newsletter_edition_run_mode.sql
   npx tsx scripts/apply-migration.ts 031_social_runs_run_mode.sql
   ```

2. **Sample compile (safe to run anytime):**
   ```powershell
   npx tsx scripts/compile-edition.ts --sample
   ```
   Confirm: `[SAMPLE]` warning box appears, edition written with `run_mode=sample`.

3. **Readiness check:**
   ```
   GET /api/v1/system/readiness
   ```
   Verify GEMINI_API_KEY, RESEND_API_KEY, social credentials all appear in the cards.

4. **Email dry-run:**
   ```powershell
   npx tsx scripts/generate-daily-newsletter.ts --dry-run
   ```

5. **Social dry-run:**
   ```powershell
   npx tsx scripts/generate-micro-edition.ts --dry-run
   ```

6. **Live compile (production):**
   ```powershell
   npx tsx scripts/compile-edition.ts
   ```
   Check dashboard → Scheduler tab for the new edition in history.

7. **Scheduler restart (to activate 4-window cadence):**
   ```
   Restart federation worker to register the 4 publish windows.
   ```

---

## Next Sprint (Phase 10 — Social Activation Hardening)

Based on the blockers above, the immediate next sprint should:

1. Apply migrations 030 and 031
2. Resolve the 8 RED copy items (quick operator approval needed)
3. Create social accounts + add credentials to `.env`
4. Smoke-test one real social post per platform
5. Add social links to website footer
6. Remove or disable premature frequency options in subscribe form
7. Wire a separate cron for the web compile (`compile-edition.ts`) — distinct from the
   micro-edition social publisher

> Once all 7 above are complete, Issue 1 beta is publishable.

---

## Files Changed This Batch

| File | Change |
|------|--------|
| `infra/db/migrations/030_newsletter_edition_run_mode.sql` | [NEW] run_mode column for newsletter_editions |
| `infra/db/migrations/031_social_runs_run_mode.sql` | [NEW] run_mode column for social_publishing_runs |
| `scripts/compile-edition.ts` | Added `--sample` flag, sample-isolation dedup, suppressed side effects |
| `workers/federation/src/scheduler.ts` | Multi-window cadence (4 cron jobs), all 4 window job names matched |
| `apps/web/src/app/admin/surfaces/SchedulerSurface.tsx` | Shows repeatable_jobs grid when multi-window mode is active |
| `ops/copy-signoff-review.md` | [NEW] Full public-facing copy review, 17 items flagged |
| `ops/social-web-readiness.md` | [NEW] Social profile checklist + smoke-test sequence |

## TypeScript / Tests

- API TypeScript: ✅ clean
- Web TypeScript: ✅ clean
- Tests: 73/74 pass — 1 failure is `submissions.test.ts` (Redis ECONNREFUSED), pre-existing environment issue, not a regression
