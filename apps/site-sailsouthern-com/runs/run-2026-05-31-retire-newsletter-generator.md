---
title: "Retire newsletter-generator.ts"
date: "2026-05-31"
type: run-brief
status: complete
---

# Run: Retire newsletter-generator.ts

**Date:** 2026-05-31

## Summary

Retired `workers/ingest/src/newsletter-generator.ts`, the old Gemini-driven newsletter system that violated the site's editorial policy by generating AI prose (editorial hooks, sign-offs) and writing directly to the `newsletters` table with `status = 'published'`, bypassing the publishing gate.

## What Was Done

| Action | Detail |
|--------|--------|
| File renamed | `workers/ingest/src/newsletter-generator.ts` → `newsletter-generator.retired.ts` (git history preserved) |
| Timer check | `scripts/deploy-timers.ts` — confirmed no reference to `newsletter-generator`; no timer removed |
| Import check | No other file imports from `newsletter-generator.ts`; no import updates needed |
| Docs updated | `docs/next-batch.md` — stale debt entry marked retired |
| Prior run brief | `runs/run-2026-05-30-publishing-gate.md` — open checkbox ticked |

## Why

The old system:
- Used Gemini 1.5 Pro to write editorial prose ("exciting hook", "editorial sign-off") — violates the no-AI-prose editorial policy
- Wrote directly to `newsletters` table with `status = 'published'` — bypassed the two-layer publishing gate entirely
- Superseded in full by `scripts/compile-edition.ts` (pure aggregation, writes `draft` to `newsletter_editions`) + `scripts/gate-edition.ts`

## Active System (unchanged)

- `scripts/compile-edition.ts` — correct replacement; pure aggregation, `draft` status, Gemini used only for section assignment (no prose)
- `scripts/gate-edition.ts` — two-layer gate (pattern + Claude API semantic check)
- Both wired in `scripts/deploy-timers.ts` under `almanac-daily-compile` and `almanac-weekly-compile`
