---
title: Yacht Scoring - Market Parity Feature Checklist
type: specification
status: active
updated_at: "2026-05-25"
---

# Market Parity Feature Checklist

This document defines the mandatory feature floor — everything a club would miss if switching from a competitor. Features are grouped by functional area. Items marked **[MVP]** must ship before any paid club goes live. Items marked **[Season 1]** can follow within the first active season.

Competitors surveyed: Sailwave, Regatta Network, Clubspot, SailBlaze.

---

## Scoring Systems

| Feature | Sailwave | Regatta Network | Us | Priority |
|---|---|---|---|---|
| PHRF Time-on-Time (ToT) | ✅ | ✅ | [ ] | **MVP** |
| PHRF Time-on-Distance (ToD) | ✅ | ✅ | [ ] | **MVP** |
| One-Design (position points, no handicap) | ✅ | ✅ | [ ] | **MVP** |
| IRC handicap scoring | ✅ | ✅ | [ ] | Season 1 |
| Portsmouth / Yardstick (dinghy) | ✅ | ✅ | [ ] | Season 1 |
| Low-point scoring (RRS Appendix A) | ✅ | ✅ | [ ] | **MVP** |
| Bonus-point scoring | ✅ | ❌ | [ ] | Season 1 |
| Custom points tables | ✅ | ❌ | [ ] | Season 1 |

---

## Finishing Codes & Penalties

All standard RRS codes must be supported. A missing code forces scorers back to spreadsheets.

| Code | Meaning | Priority |
|---|---|---|
| DNF | Did Not Finish | **MVP** |
| DNS | Did Not Start | **MVP** |
| DNC | Did Not Compete (did not come to start area) | **MVP** |
| OCS | On Course Side at start (general recall excluded) | **MVP** |
| BFD | Black Flag Disqualification | **MVP** |
| DSQ | Disqualified | **MVP** |
| RET | Retired during race | **MVP** |
| RAF | Retired After Finishing (scored as DNF) | **MVP** |
| TLE | Time Limit Expired | **MVP** |
| ZFP | 20% penalty (Z flag rule) | **MVP** |
| SCP | Scoring Penalty (percentage-based) | **MVP** |
| RDG | Redress Given (manual points entry) | Season 1 |
| NSC | No subsequent correction (protest resolved, no change) | Season 1 |
| OOD | Officer of the Day (assigned average points) | Season 1 |
| AVG | Average points (replacement score) | Season 1 |

---

## Series & Throwout Rules

| Feature | Priority |
|---|---|
| Fixed throwout: worst N races discarded | **MVP** |
| Progressive throwout: 1 throwout per N races sailed | **MVP** |
| Throwout eligibility: races completed ≥ minimum to qualify for throwout | **MVP** |
| Multiple throwout tiers (e.g., 1 throwout after race 4, 2 after race 8) | Season 1 |
| Throwout exclusions (e.g., final race cannot be thrown) | Season 1 |
| Tiebreaker: most recent race | **MVP** |
| Tiebreaker: head-to-head in tied races | **MVP** |
| Tiebreaker: most wins / most second places (cascade) | Season 1 |
| Average points for boats that didn't race (series starters rule) | Season 1 |

---

## Fleet & Division Management

| Feature | Priority |
|---|---|
| Multiple fleets per race/series (e.g., PHRF A, PHRF B, Cruising) | **MVP** |
| Fleet-specific PHRF rating bands (e.g., 0–90, 91–165) | **MVP** |
| Scratch boat designation (boat with lowest/highest rating used as reference) | **MVP** |
| One-design class management (no handicap, position scoring) | **MVP** |
| Mixed fleet (PHRF + one-design in same race, scored separately) | Season 1 |
| Course-specific fleet splits (different fleets on different courses) | Season 1 |

---

## Boat & Entry Management

| Feature | Priority |
|---|---|
| Boat record: name, sail number, skipper, yacht club | **MVP** |
| PHRF rating stored per boat | **MVP** |
| PHRF certificate fields: rating, cert number, issuing authority, expiry | **MVP** |
| Local rating adjustment (club-applied handicap correction) | Season 1 |
| Boat entry to a series (assign boat to fleet within series) | **MVP** |
| Late entry (add boat to series after it has started) | **MVP** |
| Boat withdrawal from series | **MVP** |
| Bulk import from CSV | Season 1 |
| Prior season carryover (reuse registered boats next season) | Season 1 |

---

## Race Configuration

| Feature | Priority |
|---|---|
| Race number / label | **MVP** |
| Race date and start time | **MVP** |
| Course type: windward-leeward | **MVP** |
| Course type: offshore / distance | Season 1 |
| Course distance (for ToD calculation) | **MVP** |
| Time limit (for TLE scoring) | **MVP** |
| Windward-leeward distance per leg (optional, for elapsed ToD) | Season 1 |
| Race status: scheduled, in-progress, scored, official, abandoned | **MVP** |
| Abandoned race: exclude from series or score as average | **MVP** |

---

## Race Day / Committee Boat Interface

| Feature | Priority |
|---|---|
| Tap-to-finish with automatic timestamp | **MVP** |
| Manual time entry (fallback) | **MVP** |
| Elapsed time entry (alternative to finish time) | **MVP** |
| Reorder finish positions (drag or manual correction before scoring) | **MVP** |
| Per-boat code/penalty entry at finish | **MVP** |
| Offline mode (no internet required during racing) | **MVP** |
| Sync on reconnect | **MVP** |
| Multiple race officers can record simultaneously | Season 1 |
| Start sequence timer / countdown | Season 1 |

---

## Results & Publishing

| Feature | Priority |
|---|---|
| Per-race results: finish order, elapsed time, corrected time, points | **MVP** |
| Series standings: cumulative points, throwout applied | **MVP** |
| Public shareable URL (no login for viewers) | **MVP** |
| Mobile-optimized results display | **MVP** |
| Throwout highlighted / struck-through in standings | **MVP** |
| Per-boat race history within a series | **MVP** |
| CSV export | **MVP** |
| PDF export (official results sheet format) | Season 1 |
| Printable start list / entry list | Season 1 |
| Email results to fleet (opt-in) | Season 1 |

---

## User & Club Administration

| Feature | Priority |
|---|---|
| Role: Club Admin (full access) | **MVP** |
| Role: Race Officer (race day only, no admin) | **MVP** |
| Role: Scorer (results entry + correction, no club settings) | **MVP** |
| Role: Public Viewer (no login, public URLs only) | **MVP** |
| Multi-user club accounts | **MVP** |
| Invite user to club by email | **MVP** |
| Password reset | **MVP** |
| Club branding (name, logo on results pages) | Season 1 |
| Audit log (who changed what result, when) | **MVP** |
| Multiple series per club (Spring Series, Fall Series, etc.) | **MVP** |

---

## Gaps We Can Win On (Competitor Weaknesses)

These are areas where Sailwave and Regatta Network are weakest — our differentiation lives here:

| Gap | What Competitors Do | What We Do |
|---|---|---|
| Mobile finish recording | Sailwave: desktop only. RegNet: clunky | Designed for phone/tablet on the water |
| Results turnaround | Sailwave: manual export after event | Live URL updates within seconds of scoring |
| Setup complexity | Sailwave: steep learning curve | 15-minute onboarding, no training required |
| Offline capability | Neither handles offline gracefully | PWA with sync — works in the harbor |
| Cost for small clubs | RegNet: expensive + overkill | $30–80/mo, no features they won't use |
| Series standings | Sailwave: static HTML export | Always-live public URL, no action required |
