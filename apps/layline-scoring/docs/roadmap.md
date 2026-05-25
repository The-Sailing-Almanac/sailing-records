---
title: Yacht Scoring - Development Roadmap
type: roadmap
status: active
updated_at: "2026-05-25"
---

# Yacht Scoring: Development Roadmap

This roadmap sequences the build from data model through GTM launch. Each phase ends with a shippable checkpoint — no phase begins until the prior one is verified and committed.

---

## Phase 1: Foundation — Data Model & Auth
**Goal:** Clean schema and working auth before any UI is built.

- [ ] Database schema: `clubs`, `users`, `roles`, `boats`, `fleets`, `series`, `races`, `entries`, `results`
- [ ] Role model: Club Admin, Race Officer, Scorer, Public (viewer)
- [ ] Auth: email/password login, club-scoped sessions
- [ ] Club creation + onboarding flow (name, timezone, contact)
- [ ] Basic admin dashboard shell (no scoring yet)

**Exit criteria:** A club admin can log in, create a club, and see an empty dashboard.

---

## Phase 2: Entry Management
**Goal:** Boats can be registered and fleet/class config can be set before race day.

- [ ] Boat registration form (boat name, sail number, PHRF rating, skipper name)
- [ ] PHRF certificate management (store rating + optional cert number + date issued)
- [ ] Fleet and division configuration (e.g., PHRF A, PHRF B, One-Design)
- [ ] Series creation (name, scoring type, throwout rules, number of races)
- [ ] Entry assignment: assign registered boats to a series/fleet
- [ ] Mobile-friendly public entry form (shareable link per series)
- [ ] Duplicate detection (same sail number in same fleet)

**Exit criteria:** A race chair can create a series, configure fleets, and collect entries via a public link on their phone.

---

## Phase 3: Race Day Interface
**Goal:** The committee boat can record a full race from the water on a tablet or phone.

- [ ] Race creation within a series (race number, course type, distance if ToD)
- [ ] Start time recording (tap to stamp, manual entry fallback)
- [ ] Finish line interface: scrollable entry list, tap to record finish order + time
- [ ] Elapsed time entry as alternative to finish time stamp
- [ ] Penalty / status codes per boat: DNF, DNS, DNC, OCS, BFD, DSQ, RET, RAF, TLE, ZFP, SCP
- [ ] Edit/correct a recorded finish before scoring is run
- [ ] Offline-capable PWA (finish recording must not require live internet)

**Exit criteria:** A race officer can run a complete race end-to-end on a phone with no internet connection and sync results when back at the dock.

---

## Phase 4: Scoring Engine
**Goal:** Correct, auditable PHRF scoring with full series standings.

- [ ] PHRF Time-on-Time (ToT) corrected time calculation
- [ ] PHRF Time-on-Distance (ToD) corrected time calculation
- [ ] Windward-leeward course scoring (primary MVP target)
- [ ] Penalty code point assignments per RRS Appendix A defaults
- [ ] Configurable throwout rules (e.g., worst 1 of first 3, worst N of season)
- [ ] Tiebreaker logic (RRS Appendix A: last race, head-to-head, etc.)
- [ ] Per-race results: corrected times, positions, points
- [ ] Series standings: cumulative points, throwouts highlighted
- [ ] Protest / redress placeholder (mark as pending, manual override)
- [ ] Scoring audit log (who changed what, when)

**Exit criteria:** Full race + series scored correctly against known Sailwave output for the same data set.

---

## Phase 5: Results Publishing
**Goal:** Fleet sees live results before they reach the dock. Zero PDFs.

- [ ] Public results URL per race (no login required)
- [ ] Public series standings URL (auto-updates after each race is scored)
- [ ] Throwout visualization (struck-through score, tooltip explanation)
- [ ] Fleet selector if multiple fleets in same series
- [ ] Mobile-optimized results layout
- [ ] Series history page (all races, all results, per boat performance)
- [ ] CSV export for race and series results (backup/archival)
- [ ] Optional PDF export of official results sheet

**Exit criteria:** A sailor can open a link on their phone at the dock and see final corrected standings within 60 seconds of the last boat finishing.

---

## Phase 6: Club Operations & Polish
**Goal:** Everything a club needs to run a full season without calling support.

- [ ] Multi-series management (e.g., Spring Series, Fall Series, Wednesday Night)
- [ ] Race calendar view
- [ ] Bulk boat import (CSV upload from prior season)
- [ ] Club branding (logo, club name on results pages)
- [ ] Email notifications: results posted, standings updated (opt-in)
- [ ] Sailor profile (optional: self-service PHRF cert update requests)
- [ ] Archival: prior season results remain accessible
- [ ] Club admin: manage users, assign roles, reset passwords

**Exit criteria:** A club can run a full 10-race series from entry to final standings with no manual workarounds.

---

## Phase 7: GTM Launch
**Goal:** Two anchor clubs on Gulf Coast using it live before paid launch.

- [ ] Free pilot tier (1 active series, unlimited races, no payment required)
- [ ] Paid tier: $30/mo (3 active series) and $80/mo (unlimited)
- [ ] Stripe integration (post-MVP, but must be in place before public launch)
- [ ] Onboarding email sequence (5 emails: setup → first race → results → standings → renew)
- [ ] Gulf Coast club outreach: scrape + cold email to Race Committee Chairs
- [ ] Sponsor/comp 2 high-visibility regattas (Harvest Moon or equivalent)
- [ ] Landing page with live demo series (public results URL as hero element)

**Exit criteria:** Two paying or piloting clubs have completed at least one full race series end-to-end.

---

## Deferred (Post-Launch)
- Payment processing for entry fees (Stripe)
- IRC / Portsmouth / Yardstick scoring systems
- Offshore / ocean racing course types
- Native mobile app (iOS/Android)
- Protest committee workflow
- PHRF certificate sync with national database
- Multi-club regatta hosting (invitational events)
