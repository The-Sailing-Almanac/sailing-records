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
**Harvester:** `ingestion/sailing_urls.py` (probes sequential eIDs)  
**Parser:** `ingestion/parser.py`

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
**Harvester:** `ingestion/icsa_harvester.py`  
**Parser:** `ingestion/icsa_parser.py`

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
**Harvester:** `ingestion/rn_harvester.py`  
**Parser:** `ingestion/rn_parser.py`

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
**Harvester:** `ingestion/cs_harvester.py`  
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
