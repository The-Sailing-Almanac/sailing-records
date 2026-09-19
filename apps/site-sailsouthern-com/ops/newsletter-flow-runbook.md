# Newsletter Flow — Operator Runbook
# Sail Southern Publishing Infrastructure

**Last updated:** 2026-05-29  
**System:** Sail Southern / Sailing Almanac  
**Operator:** This document is for whoever is running a publishing cycle.

---

## Two-Part Publishing Model

Every daily issue has two components. They are independent but complementary.

| Component | Script | Output | Required for |
|-----------|--------|--------|-------------|
| **Web issue** | `compile-edition.ts` | `newsletter_editions` + `newsletter_slots` in DB | `/daily/[date]` page, section routing |
| **Email derivative** | `generate-daily-newsletter.ts` | `newsletters` in DB + Resend broadcast | Subscriber email, RSS feed |

Run **web issue first**, then optionally the email derivative. Both read from `article_links`.

> **Note:** The scheduler runs `generate-micro-edition.ts` (social micro-posts) — not either newsletter script. Newsletter compilation is currently manual.

---

## Step 1 — Verify readiness

Open the admin dashboard → Readiness tab.

All of the following must be green before a live run:
- Newsletter generation ✅ (GEMINI_API_KEY)
- Email delivery ✅ (RESEND_API_KEY) — only needed for email broadcast
- DATABASE_URL ✅
- Wayback archive credentials ✅ (for archive handoff)

If any are blocked, check `.env` and fix before continuing.

---

## Step 2 — Dry-run compile (web issue)

```powershell
# From repo root
npx tsx scripts/compile-edition.ts --dry-run
```

Expected output:
```
[CompileEdition] type=daily date=YYYY-MM-DD dry-run=true
[CompileEdition] Dynamic threshold: 0.xxx (70th pct of N articles)
[CompileEdition] N candidates (threshold=0.xxx)
[CompileEdition] Gemini assigned N articles to sections
[CompileEdition] Prepared N slots across N sections
[CompileEdition] DRY RUN — no DB writes.
[{ "article_id": ..., "section": ..., ... }]
```

**If you see 0 candidates:** Check that feed ingestion has run recently. Run `npx tsx scripts/check-data-quality.ts` to inspect the pipeline state.

**If Gemini fails:** Check `GEMINI_API_KEY` in `.env`. Ensure it has access to `gemini-2.5-flash`.

---

## Step 3 — Dry-run email derivative

```powershell
npx tsx scripts/generate-daily-newsletter.ts --dry-run
```

Expected output:
```
────────────────────────────────────────────────────────────
  Daily newsletter — YYYY-MM-DD  [DRY RUN]
────────────────────────────────────────────────────────────
  ✅ Gemini API key present
  ✅ Resend API key present
  ✅ DATABASE_URL present
  ⚠️  GA4_MEASUREMENT_ID or GA4_API_SECRET missing (expected if not yet configured)
  ✅ Found 30 candidate articles
  ✅ AI generated N,NNN characters of newsletter content

  First 500 characters: [preview text]

  ⚠️  Re-run without --dry-run to save to DB and broadcast to subscribers.
```

---

## Step 4 — Live compile (web issue)

When dry-runs look good, run the real compile. This writes to DB. **Idempotent** — safe to re-run.

```powershell
npx tsx scripts/compile-edition.ts
```

After this:
- A `newsletter_editions` row is created/updated for today's date (status = `draft`)
- `newsletter_slots` rows are created for each article-section assignment
- Edition is in `draft` status — not yet visible at `/daily/[date]`

To publish (make it visible):

```powershell
# Publish the edition for today
npx tsx scripts/archive-edition.ts --date TODAY --publish
```

Or manually via SQL:
```sql
UPDATE newsletter_editions
SET status = 'published', published_at = NOW()
WHERE edition_date = CURRENT_DATE AND edition_type = 'daily';
```

After publishing, visit `/daily/latest` — it should redirect to today's issue.

---

## Step 5 — Live email broadcast (optional)

Only run this after the web issue is published. Email goes to all active subscribers.

```powershell
npx tsx scripts/generate-daily-newsletter.ts
```

> **Warning:** This sends real email to real subscribers. Confirm subscriber list is accurate before running.

For a retroactive edition (no email broadcast):
```powershell
npx tsx scripts/generate-daily-newsletter.ts --date YYYY-MM-DD
```

---

## Step 6 — Verify the issue

1. Visit `/daily/latest` — should redirect to `/daily/YYYY-MM-DD`
2. Visit `/daily/YYYY-MM-DD` — should render the edition with section content
3. Check admin dashboard → Publishing Runs tab — run should appear in history
4. Check admin dashboard → Scheduler tab → Queue health grid — `wayback-spn` queue should show archive jobs queued
5. Check `/api/v1/newsletters/feed.rss` — today's issue should appear if email derivative was also run

---

## Step 7 — Verify archive handoff

After a live run, the Wayback archive worker should queue a capture of the published edition URL.

Check: Admin → Scheduler → Archive queue card

If `wayback-spn` queue shows jobs waiting or active → archive is in progress.
If it shows 0 waiting and the run completed → either already captured or the worker isn't running.

To manually verify archive:
```powershell
npx tsx scripts/backfill-wayback-captures.ts --dry-run
```

---

## Schedule (current)

The scheduler is configured via env vars:

```
PUBLISH_CRON_PATTERN="0 8 * * *"   # 8:00 AM daily (default)
PUBLISH_TIMEZONE="America/Chicago"  # Central time
```

For 5am Central daily compile, set:
```
PUBLISH_CRON_PATTERN="0 5 * * *"
PUBLISH_TIMEZONE="America/Chicago"
```

> **Note:** The scheduler only runs `generate-micro-edition.ts` (social micro-posts) automatically. Daily newsletter compilation is manual until a separate cron is added.

---

## Trigger source tracking

| How you ran it | trigger_source in DB |
|---------------|---------------------|
| Scheduler (BullMQ) | `scheduler` |
| Manual from CLI | `manual` (set via --trigger-source if added, defaults to `scheduler`) |
| API call to publish-now endpoint | `api` |

Run history is visible in admin → Publishing Runs tab with colored badges.

---

## Troubleshooting

| Symptom | Check | Fix |
|---------|-------|-----|
| 0 candidates | Feed ingestion stale | Run `check-data-quality.ts` |
| Gemini 404 | Wrong model | Confirm `gemini-2.5-flash` in script |
| Gemini quota | Daily limit hit | Wait or use `gemini-2.5-flash-lite` |
| Email not sent | RESEND_API_KEY missing | Add to `.env` |
| `/daily/latest` shows empty | No published editions | Publish an edition via SQL or archive-edition.ts |
| Queue stalled | Worker not running | Start federation worker: `npm run dev --workspace=workers/federation` |
| Archive not captured | WAYBACK_ACCESS_KEY missing | Add S3 keys from archive.org/account/s3.php |
