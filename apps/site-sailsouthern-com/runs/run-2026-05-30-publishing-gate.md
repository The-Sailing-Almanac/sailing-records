---
title: "Publishing Gate & Editorial Compliance Sprint"
date: "2026-05-30"
type: run-brief
status: complete
---

# Run: Publishing Gate & Editorial Compliance

**Date:** 2026-05-30

## Summary

Implemented the two-layer AI editorial gate, upgraded the notification system to six channels, fixed several live site exposure issues, and completed a full editorial compliance audit of the codebase.

---

## Exposure Issues Fixed

| File | Issue | Fix |
|------|-------|-----|
| `apps/web/src/content/posts/first-post.md` | Build-diary post live on site | Deleted; 301 redirect `/blog/first-post` → `/` added to `next.config.ts` |
| `apps/web/src/app/support/page.tsx` | `alan@sailsouthern.com` in public contact section | Replaced with `hello@sailsouthern.com` |
| `apps/web/src/app/support/page.tsx` | "Quarterly video brief with the operators" | Replaced with community placeholder |
| `apps/web/src/app/support/page.tsx` | "Direct advisory access to development roadmaps" | Replaced with governance seat copy |
| `apps/web/src/app/support/page.tsx` | "Our operator has been notified" | Neutralised |
| `apps/web/src/app/submit/page.tsx` | `captain@sailsouthern.com` placeholder | Replaced with `you@example.com` |
| `apps/api/src/lib/mailer.ts` | `newsletter@sailsouthern.com` FROM address | → `hello@sailsouthern.com` |
| `apps/api/src/routes/v1.ts` | `no-reply@sailsouthern.com` FROM address | → `hello@sailsouthern.com` |

## Security Fixes

| File | Fix |
|------|-----|
| `apps/web/src/app/daily/[date]/page.tsx` | Added `DOMPurify.sanitize()` around `marked.parse()` — XSS via untrusted RSS feed content |
| `apps/web/src/lib/posts.ts` | Same fix for blog post renderer |
| `apps/web/package.json` | Added `isomorphic-dompurify` dependency |

## Publishing Gate — Built

### New Files
- `scripts/gate-edition.ts` — Layer 2 gate script (Claude API semantic check)
- `scripts/lib/gate-policy.ts` — Single source of truth for all editorial rules
- `infra/db/migrations/035_editorial_gate.sql` — Gate status columns on `article_links` and `newsletter_editions`

### Updated Files
- `apps/api/src/lib/notifications.ts` — Added email (Resend), ntfy, SMS (Twilio), severity levels
- `workers/ingest/src/lib/notifications.ts` — Same
- `scripts/lib/notifications.ts` — Same (third copy — consolidation to shared package on backlog)
- `package.json` — Added `@anthropic-ai/sdk` and `resend` root dependencies; added `gate-edition` script
- `docs/next-batch.md` — Full gate architecture documented; CTA, tagline, community backlog items added

### Gate Architecture
Two layers:
1. **Pattern check** (scripts/gate-edition.ts) — personal names, private repo links, build-diary phrases, AI tell phrase density. No LLM — fast and free.
2. **Claude API semantic check** (claude-sonnet-4-6) — editorial prose detection, political content, speculation, technology meta-commentary. System prompt cached via Anthropic prompt caching.

Verdict states: `pass` → approved, `warn` → held for operator review, `block` → hard stop, exit 1.
Detailed JSONB audit log written to `newsletter_editions.gate_notes` on every run.

### New Env Vars Required
```
ANTHROPIC_API_KEY=
NTFY_TOPIC=
NTFY_URL=https://ntfy.sh
ALERT_EMAIL=hello@sailsouthern.com
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=
TWILIO_TO=
GATE_NAME_BLOCKLIST=Alan Woodyard,aewoodyard,Alan W
```

---

## Pending Actions Before Gate Goes Live

- [ ] Run `npm install` at root to pull `@anthropic-ai/sdk` and `resend`
- [ ] Run `npm run migrate` to apply migration 035
- [ ] Add new env vars to chantecler-01 `.env`
- [ ] Add `gate-edition` to systemd timer chain after `compile-edition` in `deploy-timers.ts`
- [ ] Rebuild `apps/api/dist/` and `workers/ingest/dist/` after notifications.ts changes
- [ ] Operator review: CTA copy approval session (all existing CTA copy is unapproved draft)
- [x] Operator review: retire `workers/ingest/src/newsletter-generator.ts` (old prose-generating system, superseded by compile-edition.ts) — completed 2026-05-31, see `runs/run-2026-05-31-retire-newsletter-generator.md`

---

## Roadmap Items Added

- Tagline development (operator sign-off required)
- CTA copy review session (all copy unapproved)
- CTA psychology research via Perplexity (scheduled 2026-07-01)
- CTA component sprint (gated on copy approval + research)
- Private community platform (email list first, cohort votes on channel)
- Gate streamlining review: 2026-12-01
- Quality standards review: 2026-12-01
