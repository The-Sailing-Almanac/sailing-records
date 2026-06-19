---
repo_name: sailing-records
repo_type: Maritime Data
security_tier: 2
lifecycle: "Active ? Planning"
updated: "2026-06-19"
---

# Agent Instructions ? sailing-records

## Security Tier: Strong (2)
Standard agent autonomy. All work via PR ? never push directly to main. No secrets in code or commit messages.

## What this repo does
Stores sailing race records and scoring data.

## Cluster
Maritime

## Upstream dependencies
Race result inputs and source record collection

## Downstream consumers
Scoring, reporting, and maritime analysis consumers

## Active horizon
```yaml
horizon:
  goal: "Apply STAX Format Wave 2 governance to sailing-records and establish baseline agent rules"
  active_sub_state: "Planning"
  next_milestone: "First productive agent task under governance in sailing-records"
  blockers: []
```

## Agent rules
1. Read this file before any action in this repo.
2. All changes via PR to main. No direct pushes.
3. No credentials, tokens, or secrets in any file tracked by git.
4. Portfolio-wide rules: `stax/ops/stax-format.md`
5. If uncertain about scope, check `stax/handoffs/handoff-current.md` for orchestration context.
