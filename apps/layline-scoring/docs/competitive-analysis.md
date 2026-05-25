---
title: Competitive Analysis & Feature Parity Matrix
type: strategy
status: draft
updated_at: "2026-05-25T05:00"
---

# Competitive Analysis & Feature Parity Matrix

## Competitor Landscape

### Racing & Scoring Tools

| Product | Type | Pricing Model | Primary Market | Core Strength |
|---|---|---|---|---|
| **Sailwave** | Desktop (Windows) | Free (donations) | Club scorers globally | Deep scoring engine, free |
| **YachtScoring** | Web SaaS | Per-event fees | US club + offshore | Full regatta lifecycle |
| **Regatta Network** | Web SaaS | No setup fee, transaction % | US clubs + national | Registration breadth |
| **RegattaHub** | Web SaaS | $5/entry | US clubs (newer) | Modern UX, simplicity |
| **Kwindoo** | Web + Mobile | Subscription tiers | International, offshore | GPS live tracking |
| **Nautical Cloud** | Web SaaS | Subscription | Offshore/distance | YB Tracker integration |
| **TopYacht** | Desktop + Web | License | Australia/NZ | Comprehensive results mgmt |
| **Manage2Sail** | Web SaaS | Subscription | Europe | Registration + entry |
| **RaceLog Web** | Web + Mobile | Unknown | US clubs | Mobile-optimized |

### All-in-One Club Management Platforms

These are the more dangerous long-term competition — platforms trying to own the entire club relationship, not just regatta day.

| Product | Type | Pricing | Market | Core Strength |
|---|---|---|---|---|
| **Clubspot** | Web SaaS | Subscription | US yacht clubs | Full club ops + AI BI |
| **SailingClubManager (SCM)** | Cloud/On-Prem | Subscription | UK/international sailing clubs | Most complete sailing-specific club OS |
| **ClubSoft** | Web SaaS | Subscription | US yacht clubs + marinas | Moorage maps, marina drag-and-drop |
| **Clubessential** | Web SaaS | Enterprise | Large private clubs | Enterprise-grade club/marina/F&B |
| **TeamSnap** | Web + Mobile SaaS | Freemium | Youth + recreational sports | Best mobile UX, 100+ sports |
| **SportsEngine** | Web + Mobile SaaS | Subscription | Youth sports orgs | Deepest feature set in general sports |
| **LeagueApps** | Web SaaS | Subscription | Youth leagues | Tournaments, scheduling |
| **Communiti** | Web + Mobile SaaS | No subscription fee | General sports clubs | Coach/parent UX, independent coaches |

### Self-Hosted / Open Source Options

| Product | Stack | Last Active | Realistic? | Notes |
|---|---|---|---|---|
| **Tendenci** | Python/Django | May 2026 (v16.11) | Yes — with caveats | Full AMS: memberships, events, donations, newsletter, CRM, forums. GPL. Not sailing-specific. |
| **CiviCRM** | PHP (Drupal/WordPress) | Active | Not really | Excellent nonprofit CRM but 2000s-era UI; deep but ugly; integration-heavy setup |
| **Hitobito** | Ruby on Rails | Active | Maybe | Swiss open source, used by large EU youth orgs; complex permission model; not sport-scoring focused |
| **Zenbership** | PHP | Dead (~2018) | No | Abandoned. Do not use. |
| **Bracket** | FastAPI + Next.js | Active (narrow) | Partial | Open source tournament bracket manager only — modern stack but no club ops |
| **Charichdeb / similar GitHub projects** | React + Django | Student projects | No | Demo-quality, not production |

**Verdict on self-hosting:** There is no modern, purpose-built, self-hostable yacht club management system. Tendenci is the only credible open source AMS still in active development with real features — but it is association-focused (nonprofits, advocacy groups), not sport-specific, and has a dated frontend despite an active backend. The gap is real.

---

## Full Feature Parity Matrix

### 1. Registration & Entries

| Feature | Sailwave | YachtScoring | Regatta Network | Clubspot | RegattaHub | Kwindoo | Nautical Cloud |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Online entry form | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Mobile-optimized registration | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Custom registration fields | — | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Entry limits & waitlists | — | — | — | ✓ | ✓ | — | — |
| Members-only classes/discounts | — | — | — | ✓ | — | — | — |
| Membership verification at entry | — | — | — | ✓ | — | — | — |
| Certificate uploads (PHRF/ORC/IRC) | — | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Compliance checklists | — | — | — | — | — | — | ✓ |
| Crew management + invitations | — | — | — | — | ✓ | ✓ | ✓ |
| Emergency contact collection | — | — | — | — | ✓ | — | — |
| Boat favorites (re-registration) | — | — | — | — | ✓ | — | — |
| E-signatures on waivers | — | — | — | ✓ | ✓ | — | — |
| Multi-event / series enrollment | — | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| Scratch sheet generation | — | ✓ | ✓ | — | — | — | — |

---

### 2. Scoring Engine

| Feature | Sailwave | YachtScoring | Regatta Network | Clubspot | RegattaHub | Kwindoo | Nautical Cloud |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| One-design scoring | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RRS Appendix A compliant | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Series throwout logic | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Qualifying + finals format | ✓ | ✓ | — | ✓ | — | — | — |
| Round-robin format | ✓ | — | — | — | — | — | — |
| Match racing format | ✓ | — | — | — | ✓ (beta) | — | — |
| Team racing + combination scoring | — | — | — | — | ✓ (beta) | — | — |
| Olympic / medal race format | ✓ | — | — | — | — | — | — |
| Pursuit racing | — | — | — | ✓ | — | — | — |
| Fleet/division/class splitting | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Multiple scoring systems per event | ✓ | ✓ | — | — | — | — | — |
| Real-time / live scoring | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Finish entry from race committee boat | — | ✓ | — | ✓ | ✓ | — | — |
| Sail Number Wizard / rapid entry | ✓ | — | — | — | — | — | — |
| DNF / DSQ / DNC / OCS code handling | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Low-point and bonus-point systems | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |
| Club series / season-long standings | — | ✓ | ✓ | ✓ | — | ✓ | — |
| Custom scoring rules / expressions | ✓ | — | — | ✓ (Sheets) | — | — | — |

---

### 3. Handicap & Rating Systems

| System | Sailwave | YachtScoring | Clubspot | RegattaHub | Kwindoo |
|---|:---:|:---:|:---:|:---:|:---:|
| PHRF (Time-on-Distance) | ✓ | ✓ | ✓ | ✓ | ✓ |
| PHRF (Time-on-Time) | ✓ | ✓ | ✓ | ✓ | ✓ |
| ORC | ✓ | ✓ | ✓ | ✓ | ✓ |
| IRC / IRM | ✓ | ✓ | ✓ | — | ✓ |
| CHS | ✓ | — | — | — | — |
| Portsmouth / US PN | ✓ | ✓ | ✓ | — | ✓ |
| Portsmouth AU / UK variants | — | — | ✓ | — | — |
| RYA PY & NHC | ✓ | — | — | — | — |
| SCHRS (small catamaran) | ✓ | — | — | — | — |
| Texel rating | ✓ | — | — | — | — |
| ORR | — | — | — | — | ✓ |
| Laser Master | — | — | ✓ | — | — |
| ECHO | ✓ | — | — | — | — |
| RORC | ✓ | — | — | — | — |
| User-definable rating systems | ✓ | — | ✓ (Sheets) | — | — |
| Local fleet rating adjustments | — | ✓ | — | — | — |
| 15 international systems | — | — | — | — | ✓ |

---

### 4. Race Day Operations

| Feature | Sailwave | YachtScoring | Regatta Network | Clubspot | RegattaHub | Kwindoo | Nautical Cloud |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Electronic sign-on / check-in | — | ✓ | — | ✓ | — | ✓ | ✓ |
| Mobile committee boat interface | — | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Finish time entry | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Elapsed time entry | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Start time management | ✓ | ✓ | — | — | ✓ | ✓ | ✓ |
| Race schedule builder | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| OCS / general recall tracking | ✓ | ✓ | — | — | — | — | — |
| Course editor / mark management | — | — | — | — | — | ✓ | ✓ |
| Waypoint timing | — | — | — | — | — | ✓ | ✓ |
| Timing device CSV import | ✓ | ✓ | — | — | — | — | — |

---

### 5. Live Tracking & GPS

| Feature | Sailwave | YachtScoring | Clubspot | RegattaHub | Kwindoo | Nautical Cloud | SailPro |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Smartphone GPS tracking | — | — | — | — | ✓ | — | ✓ |
| Dedicated hardware tracking | — | — | — | — | — | ✓ (YB) | ✓ |
| Real-time fleet map | — | — | — | — | ✓ | ✓ | ✓ |
| 3D race visualization | — | — | — | — | ✓ | — | — |
| Replay functionality | — | — | — | — | ✓ | ✓ | ✓ |
| Live leaderboard | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Spectator public view | — | ✓ | — | — | ✓ | ✓ | ✓ |
| Speed heatmaps | — | — | — | — | ✓ | — | — |
| VMG / tack analysis | — | — | — | — | ✓ | — | — |
| Head-to-head boat comparison | — | — | — | — | ✓ | — | — |
| YB Tracker integration | — | — | — | — | — | ✓ | — |
| Protest replay review | — | — | — | — | ✓ | — | — |
| SOS / safety alert | — | — | — | — | ✓ | — | — |

---

### 6. Results Publishing

| Feature | Sailwave | YachtScoring | Regatta Network | Clubspot | RegattaHub | Kwindoo | Nautical Cloud |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Public shareable results URL | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Results live before docking | — | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| HTML publish | ✓ | ✓ | ✓ | — | — | — | — |
| PDF export | ✓ | ✓ | ✓ | — | — | — | — |
| Excel / Word export | ✓ | ✓ | — | — | — | — | — |
| FTP / SFTP / SSH publish | ✓ | — | — | — | — | — | — |
| Email results distribution | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| XML / World Sailing submission | ✓ | — | — | — | — | — | — |
| RYA returns | ✓ | — | — | — | — | — | — |
| Embeddable website widget | — | ✓ | ✓ | ✓ | — | — | — |
| Social media sharing | — | — | — | — | — | ✓ | — |
| Prize table / awards export | ✓ | ✓ | ✓ | — | — | — | — |

---

### 7. Communications

| Feature | Sailwave | YachtScoring | Regatta Network | Clubspot | RegattaHub | Kwindoo | Nautical Cloud |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Digital notice board | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Broadcast email to entrants | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SMS / text alerts | — | ✓ | — | — | — | ✓ | ✓ |
| Race-wide messaging (on-water) | — | — | — | — | — | ✓ | — |
| Automated notifications | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Document / NOR / SI distribution | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Start time change alerts | — | — | — | — | — | — | ✓ |
| Club newsletter tools | — | — | — | ✓ | — | — | — |
| Targeted member segments | — | — | — | ✓ | — | — | — |

---

### 8. Protest & Hearings Management

| Feature | Sailwave | YachtScoring | Regatta Network | Clubspot | RegattaHub | Kwindoo | Nautical Cloud |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Digital protest submission | — | — | — | — | ✓ | ✓ | ✓ |
| Scoring inquiry submission | — | — | — | — | ✓ | — | — |
| Hearing board management | — | — | — | — | — | — | ✓ |
| GPS replay for protest review | — | — | — | — | — | ✓ | — |
| Score correction workflow | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RRS A7/A8 compliance tools | — | — | — | — | ✓ | — | — |

---

### 9. Financial & Payments

| Feature | Sailwave | YachtScoring | Regatta Network | Clubspot | RegattaHub | Kwindoo | Nautical Cloud |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Online credit card processing | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PayPal | — | ✓ | — | — | — | — | — |
| Apple Pay / bank transfer | — | — | — | ✓ | — | — | — |
| Member charge to account | — | — | — | ✓ | — | — | — |
| Manual payments (cash/check) | — | — | — | — | ✓ | — | — |
| Coupons / discount codes | — | — | — | ✓ | — | — | — |
| Late fees | — | — | — | ✓ | — | — | — |
| Refund management | — | — | — | — | ✓ | — | — |
| Automatic tax calculation | — | — | — | ✓ | — | — | — |
| Accounting integrations | — | — | — | ✓ | — | — | — |
| Multi-currency support | — | — | — | — | — | ✓ | ✓ (155 currencies) |
| Stripe payouts | — | — | — | — | ✓ | ✓ | ✓ |
| Merchandise / meal pre-orders | — | — | ✓ | — | — | — | — |

---

### 10. Club Management (beyond race ops)

This is where the all-in-one platforms differentiate. SCM and Clubspot are the ceiling; the table below maps against all club management competitors.

| Feature | Clubspot | SCM | ClubSoft | TeamSnap | SportsEngine | Communiti |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Member database | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Member self-service portal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Membership tiers & renewals | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Recurring membership billing | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Boat / vessel records | ✓ | ✓ | ✓ | — | — | — |
| Mooring / slip assignment | ✓ | ✓ | ✓ | — | — | — |
| Drag-and-drop marina map | — | — | ✓ | — | — | — |
| Boat park / rack / on-water moorings | — | ✓ | ✓ | — | — | — |
| Mooring waitlist | ✓ | ✓ | ✓ | — | — | — |
| Crew finder / crew matching | — | ✓ | — | — | — | — |
| Duty / volunteer rostering | — | ✓ | — | — | — | — |
| Qualifications / certifications tracking | — | ✓ | — | — | ✓ | — |
| Access control (key fob / card) | — | ✓ | — | — | — | — |
| Point of sale (bar / pro shop) | ✓ | ✓ | — | — | — | — |
| Stock control (EPoS) | — | ✓ | — | — | — | — |
| Direct debit / bank processing | — | ✓ | ✓ | — | — | — |
| Invoicing (memberships, berths, merch) | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Accounting integrations | ✓ | ✓ | ✓ | — | — | — |
| Social / event calendar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Club website / CMS | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Branded club mobile app | ✓ | — | — | ✓ | ✓ | ✓ |
| Parent app (youth) | — | — | — | ✓ | ✓ | ✓ |
| Junior program management | ✓ | ✓ | — | ✓ | ✓ | — |
| Camps / clinics registration | ✓ | — | — | ✓ | ✓ | — |
| Trophy / awards tracking | — | ✓ | — | — | — | — |
| Sponsorship management | — | — | — | ✓ | — | — |
| Live streaming | — | — | — | ✓ | ✓ | — |
| Role-based staff access | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| AI business intelligence | ✓ | — | — | — | — | — |
| Email list segmentation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SMS communications | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Member reviews / ratings | — | — | — | — | — | ✓ |

---

### 11. Developer & Integration Surface

| Feature | Sailwave | YachtScoring | Regatta Network | Clubspot | RegattaHub | Kwindoo |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Public API | — | Partial | — | — | — | — |
| CSV import/export | ✓ | ✓ | ✓ | ✓ | — | — |
| World Sailing XML | ✓ | — | — | — | — | — |
| YB Tracker integration | — | — | — | — | — | ✓ |
| Google Sheets integration | — | — | — | ✓ | — | — |
| Accounting system integration | — | — | — | ✓ | — | — |
| Embeddable widgets | — | ✓ | ✓ | ✓ | — | — |
| White-label / club branding | — | Partial | ✓ | ✓ | — | — |
| Open source | — | — | — | — | — | — |

---

## Open-Core Framework Proposal

**None of these competitors are open source.** This is a structural moat we can build.

### The Model: Open Core

The open-core model ships a fully functional free tier as open source while reserving commercial-grade infrastructure and integrations for a paid cloud product.

```
yacht-scoring/
├── core/          ← Open source (MIT or Apache 2.0)
└── cloud/         ← Proprietary SaaS layer
```

---

### Core (Open Source) — What Goes in the Free Tier

These are the features that make the project credible and drive adoption:

**Scoring Engine**
- One-design scoring with full RRS Appendix A compliance
- Series throwout logic (standard + custom)
- PHRF Time-on-Distance and Time-on-Time
- Portsmouth (US) handicap
- ORC basic scoring
- Multiple fleets/divisions per event
- DNF/DSQ/OCS/DNC/RAF/RET code handling
- Qualifying + finals, pursuit, and club series formats
- Low-point and bonus-point systems

**Race Day**
- Finish entry interface (web, mobile browser)
- Elapsed time and corrected time calculation
- Live results as finishes are entered
- Scratch sheet generation

**Results Publishing**
- Public shareable results URL (no account required to view)
- HTML export
- CSV / Excel export
- Series standings with season history

**Club Series**
- Season management (multiple series per season)
- Race officer notes per race
- Basic notice board (text/document posts)

**Self-Hosting**
- Docker-based self-host path
- SQLite or Postgres backend
- Full data ownership and export

---

### Cloud (Proprietary) — What Drives Revenue

These are the features that clubs pay for:

| Feature | Rationale |
|---|---|
| Managed hosting (no DevOps) | Core value prop for volunteer race officers |
| Payment processing (Stripe) | Requires trust, compliance, merchant relationship |
| Credit card / Apple Pay / bank transfer entry fees | Revenue share or flat fee |
| Coupons, late fees, refunds | Operationally complex |
| E-signatures on waivers | Legal compliance, storage, audit trail |
| Advanced handicap systems (IRC, IRM, CHS, RORC, SCHRS, ORR) | Data licensing costs |
| GPS live tracking (smartphone) | Infrastructure cost, bandwidth |
| Live fleet map + spectator view | Real-time infra |
| Kiosk / committee boat dedicated app | Native app dev + distribution |
| Multi-club / fleet organization accounts | Org management complexity |
| Membership verification at registration | Club DB integration |
| SMS race alerts | Carrier costs |
| AI series analytics and performance trends | Compute cost |
| White-label (custom domain, club branding) | Setup + support cost |
| Priority support SLA | Time cost |
| Data sync with World Sailing / US Sailing | Certification + relationship |
| Accounting integrations (QuickBooks, Xero) | Integration maintenance |

---

### Competitive Positioning by Tier

| Segment | Our position |
|---|---|
| **Volunteer club scorer replacing Sailwave** | Free core. No install, no Windows required. Same scoring depth, browser-based. |
| **Small club (<30 boats) running weekly series** | $0–$30/mo cloud. Online entry, live results URL, no manual PDFs. |
| **Mid-size club (30–150 boats) with paid regattas** | $30–80/mo cloud. Payments, waivers, GPS tracking, SMS alerts. |
| **Large open regatta / national event** | Custom / enterprise. Full GPS tracking, live spectator feed, multi-fleet, scoring officials access. |
| **Developers / national federations** | Self-host the open core. Extend scoring engine for local handicap systems. |

---

### Why Open Core Wins Here

1. **Trust**: Volunteer race officers are skeptical of new software. Open source lets them audit the scoring math before trusting it with a real regatta.
2. **Adoption flywheel**: A club's scorer uses the free tier, loves it, then asks the club manager to pay for online entries. That's a bottom-up B2B motion.
3. **Community handicap systems**: Contributors in the UK/AU/EU will add RYA, TopYacht-style, and regional systems that we'd never build ourselves — expanding the TAM without engineering cost.
4. **No moat for incumbents**: Sailwave is not open source. Clubspot, SCM, and Regatta Network are black boxes. We become the reference implementation.
5. **Credibility with federations**: US Sailing, World Sailing, and national authorities are more likely to certify / endorse an auditable scoring engine.
6. **The self-hosting gap is real**: There is no modern, self-hostable, purpose-built yacht club platform. Tendenci is the closest thing and it's a generic nonprofit AMS with a dated UI. Clubs that have tried it describe it as "CiviCRM with a facelift." A Docker-deployable open core with modern UI (React/Next.js frontend, FastAPI or Django backend) would be unopposed in that segment.

---

## Parity Gap Summary

Features required to reach **baseline competitive parity** (i.e., a club would consider switching from Sailwave or Regatta Network) are all in the open core above. The full feature list to match the most capable competitor (Clubspot at the high end) totals roughly:

- **Registration**: 14 features
- **Scoring engine**: 18 features
- **Handicap systems**: 17 systems
- **Race day ops**: 10 features
- **Live tracking**: 14 features (Kwindoo parity — cloud tier)
- **Results publishing**: 12 features
- **Communications**: 9 features
- **Protest management**: 6 features
- **Payments**: 13 features (cloud tier)
- **Club management**: 12 features (cloud tier, long-term)
- **Dev/integration surface**: 8 features

**MVP parity target** (replace Sailwave + basic Regatta Network for a small club): ~35 features across scoring, registration, results, and basic comms. Achievable in a focused first build.

**Full Clubspot parity**: Marina management, POS, and branded mobile app are out of scope for v1 and probably represent a separate product line if pursued at all.
