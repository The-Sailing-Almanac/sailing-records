# Data Sources and Provenance

This document records what each data source is, what it provides, how it is accessed,
and any known limitations or ethical considerations.

---

## YachtScoring

**URL:** https://yachtscoring.com  
**Type:** Commercial regatta management platform  
**Access method:** Public HTTP endpoints; event data accessed via sequential event ID (`eID`)  
**Raw format:** JSON (`event.json`, `boats.json`, `races.json`, `splits.json`, `cumulative.json`)  
**Raw storage:** `raw/{eID}/`  
**Harvester:** `packages/sailing-records/src/sailing_records/ingestion/sailing_urls.py` (probes sequential eIDs)
**Parser:** `packages/sailing-records/src/sailing_records/ingestion/parser.py`

**What it provides:**
- Regatta metadata (name, dates, city, state)
- Boat records (name, design, length, sail number, YachtScoring boat ID)
- Sailor records (full name, club, role: owner/skipper/crew/tactician)
- Race-level results (finish position, status, race value)

**Known limitations:**
- Some events are private or incomplete; handled as `_missing.flag` in raw/
- Compound owner names (e.g., "Mark & Jolene") require splitting logic
- No federation IDs (World Sailing / US Sailing) in the raw data
- Club names are unstandardized and require normalization

**Ethical note:** Public competition results. No personally sensitive data beyond name and club affiliation. Standard web crawling of publicly available event data.

---

## ICSA Techscore

**URL:** https://scores.collegesailing.org  
**Type:** Inter-Collegiate Sailing Association official scoring system  
**Access method:** Public HTML pages; season indexes → regatta slugs  
**Raw format:** HTML (`main.html`, `sailors.html`)  
**Raw storage:** `raw_icsa/{season}/{slug}/`  
**Harvester:** `packages/sailing-records/src/sailing_records/ingestion/icsa_harvester.py`
**Parser:** `packages/sailing-records/src/sailing_records/ingestion/icsa_parser.py`

**What it provides:**
- College sailing regattas (US collegiate circuit, seasons f08–present)
- Sailor records: full name, school/club, division, graduation year, ICSA slug
- Participation records: school, division, race range
- No boat concept — college sailing assigns sailors to positions, not vessels

**Known limitations:**
- No boat-level data; `boat_id` is NULL for all ICSA records
- Graduation year is approximate (derived from class year field)
- Sailor identity across seasons relies on the ICSA slug (URL-based)

**Ethical note:** Official public results published by ICSA. Student sailors' names and school affiliations are published as part of official competition records.

---

## Regatta Network

**URL:** https://regattanetwork.com  
**Type:** Regatta management and results platform (club-level and one-design)  
**Access method:** Public HTML; results pages accessed by sequential regatta ID (1–32000+)  
**Raw format:** HTML results applet (`results.html`)  
**Raw storage:** `raw_rn/{id}/`  
**Harvester:** `packages/sailing-records/src/sailing_records/ingestion/rn_harvester.py`
**Parser:** `packages/sailing-records/src/sailing_records/ingestion/rn_parser.py`

**What it provides:**
- Club and one-design fleet results
- Skipper names (compound splitting applied)
- Boat name, sail number, yacht club
- Fleet/division breakdowns

**Known limitations:**
- HTML structure varies significantly across eras; dynamic column detection required
- Some result pages are empty or use non-standard layouts (classified as `empty`/`missing`)
- No standardized boat or sailor IDs
- Skipper compound names (e.g., "Roy / Marina") require splitting

**Ethical note:** Public competition results. Club-level racing data.

---

## Clubspot

**URL:** https://theclubspot.com  
**API:** `https://theclubspot.com/parse/` (Parse platform REST API)  
**Type:** Regatta registration and management platform  
**Access method:** Public Parse REST API — no authentication required for public events  
**Raw format:** JSON (paginated, 1000 records per batch)  
**Harvester:** `packages/sailing-records/src/sailing_records/ingestion/cs_harvester.py`
**Parser:** **Not yet built** — see [pipeline.md](pipeline.md)

**What it provides:**
- Regatta metadata (name, dates, location, event type, skill level)
- Registrations (sailor/boat/class associations)
- Registration status (confirmed, waitlisted, etc.)
- Richer classification metadata than other platforms (class, skill level, event type)

**Known limitations:**
- Parser not yet implemented; harvest data exists but has not been loaded into `sailing_data.db`
- API app ID is public and documented in `archive/cs_test.py` (proof-of-concept reference)
- No federation IDs in registration data

**Ethical note:** Public regatta registrations via a platform whose API requires no authentication, indicating intentional public exposure of event data. Registration data includes name and club only — no private contact information is harvested.

---

## General Notes

- All scraped data is competition-record data: names, clubs, boats, results.
- No private contact information, addresses, or financial data is collected.
- All source data is publicly accessible without login.
- Raw files are preserved locally and gitignored. They are not redistributed.
- If a source platform changes its access policy or requests removal, stop harvesting and document that decision here.

---

## International Expansion Candidates

The next source expansion is international, with Europe first. See
[international.md](international.md) for the multilingual ingestion rules and
development order.

### manage2sail

**URL:** https://www.manage2sail.com  
**Type:** International regatta management and results platform  
**Initial role:** European championship and class-event source  
**Raw storage target:** `raw_intl/manage2sail/`  
**Status:** Candidate source; no harvester/parser yet

**Notes:**
- Public event pages and downloadable result reports are common.
- Reports may be HTML or PDF; preserve originals before extraction.
- Source wording and formatting must remain intact because event names, club
  names, and report labels may be multilingual.

### Sailwave published results

**URL:** https://www.sailwave.com/results  
**Type:** Published static results from Sailwave scoring software  
**Initial role:** First international parser target  
**Raw storage target:** `raw_intl/sailwave/`  
**Harvester:** `packages/sailing-records/src/sailing_records/ingestion/sailwave_harvester.py`
**Parser:** `packages/sailing-records/src/sailing_records/ingestion/sailwave_parser.py`
**Status:** Seeded first-pass support

**Notes:**
- Many result pages are static HTML with table-based results.
- Used internationally at club, national, and championship levels.
- Parser should preserve original table headers and race-cell text before
  mapping columns to canonical fields.

### RegattaBase

**URL:** https://regattabase.com  
**Type:** German-speaking sailing regatta, club, and sailor index  
**Initial role:** European discovery/index source  
**Raw storage target:** `raw_intl/regattabase/`  
**Status:** Candidate source; no harvester/parser yet

**Notes:**
- Strong candidate for Germany/Austria/Switzerland coverage.
- German labels and names should be stored exactly as published.
- Use initially for discovery and source linking before broad parsing.

### SailingResults.net

**URL:** https://sailingresults.net  
**Type:** Regatta entry and result platform  
**Initial role:** Secondary international platform candidate  
**Raw storage target:** `raw_intl/sailingresults/`  
**Status:** Candidate source; no harvester/parser yet

**Notes:**
- Evaluate source structure and access policy with seeded public result pages
  before writing a broad harvester.

### Topyacht

**URL:** https://topyacht.com.au  
**Type:** Australian race management and results software  
**Initial role:** Australia/New Zealand expansion candidate  
**Raw storage target:** `raw_intl/topyacht/`  
**Status:** Candidate source; no harvester/parser yet

**Notes:**
- Australian Sailing lists Topyacht as a major Australian race-management
  provider.
- Evaluate public result URL patterns before broad harvesting.

### SailSys

**URL:** https://www.sailsys.com.au  
**Type:** Australian race-management and club results platform  
**Initial role:** Australia expansion candidate  
**Raw storage target:** `raw_intl/sailsys/`  
**Status:** Candidate source; no harvester/parser yet

**Notes:**
- Australian Sailing identifies SailSys as a competition-management option.
- Start from seeded public event pages only.

### Sailing South Africa

**URL:** https://sailingsa.co.za  
**Type:** South African sailing portal and results index  
**Initial role:** Southern Africa discovery source  
**Raw storage target:** `raw_intl/sailing_sa/`  
**Status:** Candidate source; no harvester/parser yet

**Notes:**
- Use initially as a discovery/index source for official public result links.
