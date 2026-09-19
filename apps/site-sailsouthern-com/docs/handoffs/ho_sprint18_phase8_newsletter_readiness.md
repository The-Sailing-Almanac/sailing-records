# Sprint Handoff — Phase 8: Newsletter Flow & Beta Publish Readiness
# Sail Southern Publishing Infrastructure

**Date:** 2026-05-29  
**Operator:** Alan Woodyard  
**Batch:** `ss-phase-8-newsletter-flow-and-beta-publish-readiness`  
**Status:** ✅ Complete

---

## Architecture Clarification: Two-Part Publishing Model

This batch confirmed that the publishing system has two separate newsletter paths. This was previously implicit; it is now documented:

| Component | Script | Table | Purpose | Status |
|-----------|--------|-------|---------|--------|
| **Web issue** | `compile-edition.ts` | `newsletter_editions` + `newsletter_slots` | Structured, section-based editorial issue. Primary source for `/daily/[date]`. | ✅ Working |
| **Email derivative** | `generate-daily-newsletter.ts` | `newsletters` | Monolithic Gemini Markdown. Email broadcast via Resend. Fallback for `/daily/[date]`. | ✅ Working |
| **Social micro-post** | `generate-micro-edition.ts` | `social_publishing_runs` | Short social platform posts. Scheduled via BullMQ. | ✅ Running |

**The scheduler only runs micro-edition automatically.** Newsletter compilation (both paths) is currently manual. See runbook.

---

## Dry-Run Verification Results

Both paths tested against live production data.

### compile-edition.ts --dry-run ✅
```
441,709 articles in DB
30 candidates at threshold 0.400 (70th percentile)
Gemini assigned 30 articles to 13 sections
35 slots prepared (some articles appear in front-page + section)
Sections: cruising, front-page, offshore-racing, sailgp, [+ 9 others]
DRY RUN — no DB writes.
```
**Result: PASS.** The editorial path works end-to-end against real data.

### generate-daily-newsletter.ts --dry-run ✅
```
✅ Gemini API key present
✅ Resend API key present  
✅ DATABASE_URL present
⚠️  GA4_MEASUREMENT_ID or GA4_API_SECRET missing
✅ Found 30 candidate articles (score ≥ 0.4, last 72 hours)
✅ AI generated 9,811 characters of newsletter content
Content preview: "Sailing Almanac: Weekly Dispatch — From the Helm..."
DRY RUN — nothing saved or sent.
```
**Result: PASS.** Email derivative generates real content from real articles.

> **Bug fixed this batch:** `generate-daily-newsletter.ts` was using deprecated `gemini-1.5-pro`. Updated to `gemini-2.5-flash`.

---

## What Was Delivered in This Batch

| Item | Status |
|------|--------|
| `compile-edition.ts` dry-run verified against live data | ✅ |
| `generate-daily-newsletter.ts` dry-run verified (bug fix: model name) | ✅ |
| `GET /system/readiness` — Newsletter generation card (GEMINI_API_KEY) | ✅ |
| `GET /system/readiness` — Email delivery card (RESEND_API_KEY) | ✅ |
| `publish_ready` gate now includes newsletter category | ✅ |
| `ReadinessSurface.tsx` — WHY copy for both new cards | ✅ |
| `/daily/latest` route — redirects to most recent published edition | ✅ |
| `/daily/latest` — graceful empty state with operator context | ✅ |
| `scheduler.ts` — explicit `trigger_source: 'scheduler'` in run insert | ✅ |
| `ops/newsletter-flow-runbook.md` — operator runbook | ✅ |
| 74/74 tests passing | ✅ |
| TypeScript clean (both apps) | ✅ |

---

## Go / No-Go: Newsletter Flow

### ✅ GO — Newsletter flow is operationally usable

**Evidence:**
- Real content generates from real data (441,709 articles, 30 candidates)
- Gemini section assignment works and produces sensible editorial structure
- 13 sections, 35 slots — that's a real issue, not a placeholder
- Email path generates 9,811 characters of formatted newsletter copy
- Both dry-runs exit cleanly with correct operator output

**The operator can run the newsletter flow today using the runbook at `ops/newsletter-flow-runbook.md`.**

---

## Issue 1 Beta Blockers (remaining)

These must be resolved before claiming "full beta ready":

| # | Blocker | Impact | Fix |
|---|---------|--------|-----|
| 1 | **No automated newsletter schedule** | Web issue requires manual CLI run each day | Add a second BullMQ cron job in `scheduler.ts` that runs `compile-edition.ts` + publish step at 5am CT |
| 2 | **Edition must be manually published** | After `compile-edition.ts` runs, edition is in `draft` status — operator must run `archive-edition.ts --publish` or update SQL | Add `--publish` flag to `compile-edition.ts` or auto-publish after compile |
| 3 | **GA4 credentials not configured** | Server-side analytics events skipped | Add `GA4_MEASUREMENT_ID` and `GA4_API_SECRET` to `.env` from GA4 property settings |
| 4 | **Social platforms not activated** | No Mastodon/Nostr/Bluesky posts for newsletter editions | See social activation checklist below |
| 5 | **Email not gated on web publish** | Subscriber email can be sent before the web issue is visible | Consider: require `compile-edition.ts` to run successfully first, or gate email on `newsletter_editions.status = 'published'` |
| 6 | **`/daily` archive index uses `newsletters` table** | Archive shows email-path editions, not editorial-path editions | Unify `/daily` index to query `newsletter_editions` as primary source |

---

## State Distinction

| State | Definition |
|-------|-----------|
| **Newsletter flow proven** | ✅ YES — both paths generate real content, dry-run works, operator can run manually |
| **Social flow activated** | ❌ NO — social platform credentials not wired; micro-edition runs but social accounts need activation |
| **Full beta ready** | ❌ NOT YET — blockers 1–4 above must be resolved |

---

## Social Activation Next Checklist

For the next batch (`ss-phase-9-social-activation`):

### Mastodon
- [ ] `MASTODON_INSTANCE_URL` set in `.env` (e.g. `https://mastodon.social`)
- [ ] `MASTODON_ACCESS_TOKEN` set in `.env`
- [ ] Smoke test: `npx tsx scripts/monitor-social-integrations.ts`
- [ ] Confirm account exists at instance URL before running

### Nostr
- [ ] `NOSTR_PRIVATE_KEY` set in `.env` (nsec or hex format)
- [ ] `NOSTR_RELAYS` set in `.env` (comma-separated, e.g. `wss://relay.damus.io,wss://nos.lol`)
- [ ] Run `npx tsx scripts/update-nostr-profile.ts` to set profile metadata
- [ ] Smoke test publish via `generate-micro-edition.ts --dry-run` → confirm Nostr leg

### Bluesky
- [ ] `BLUESKY_IDENTIFIER` set in `.env` (handle, e.g. `yourname.bsky.social`)
- [ ] `BLUESKY_PASSWORD` set in `.env` (app password, NOT login password)
- [ ] Smoke test: confirm `publishToBluesky` adapter returns success

### Smoke test for all three
```powershell
npx tsx scripts/generate-micro-edition.ts --dry-run
```
Confirm all three social legs log expected output without errors.

### After activation: verify trigger and run history
- Trigger a manual micro-edition publish from the dashboard (publish-now)
- Check Publishing Runs tab — should show `trigger_source: manual` with amber badge
- Check Social Delivery tab — should show Mastodon, Nostr, Bluesky delivery status

---

## Recommended Cron for Issue 1 Beta

Set in `.env` and restart the federation worker:

```
PUBLISH_CRON_PATTERN="0 5 * * *"
PUBLISH_TIMEZONE="America/Chicago"
```

This schedules micro-edition at 5am CT daily. For the daily web issue, add a second cron job after social activation is confirmed working.

---

## Open Questions Left for Operator

1. **Which path is canonical?** Should the `/daily` archive index query `newsletter_editions` (editorial path) or keep using `newsletters` (email path)? My recommendation: `newsletter_editions` as primary, `newsletters` as fallback — but this needs a decision before the archive index is updated.

2. **Multi-window publishing?** (5am/11am/5pm/11pm). Recommendation: single 5am CT for Issue 1 beta. Confirm before Phase 9.

3. **Auto-publish on compile?** Should `compile-edition.ts` auto-publish (draft → published) after a successful run, or keep the manual publish step as a safety gate?
