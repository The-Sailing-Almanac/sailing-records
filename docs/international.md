# International and Multilingual Expansion

This document defines the expansion track for sailing results outside the current
US-focused sources. Europe is the first priority, but the same rules apply to
other regions.

## Core Rule: Preserve Source Text

International ingestion must never overwrite or replace source-language data.
Every harvester and parser added under this track must preserve:

- The original raw file exactly as fetched, including encoding, markup, field
  names, punctuation, whitespace, and source-language wording.
- The original source URL and fetch timestamp.
- The detected or declared source language when available.
- Any translated, normalized, or English helper fields as derived metadata only.

Translations are allowed for search, grouping, and user-facing display, but they
must be traceable back to the raw source text. If a translation is wrong, the
raw source should still be enough to re-parse or correct the derived field.

## Storage Pattern

Use a dedicated raw directory for new international sources:

```text
raw_intl/
  manage2sail/
  sailwave/
  regattabase/
  sailingresults/
  world_sailing/
```

Each harvested event should keep the original source artifact and a small
metadata sidecar:

```text
raw_intl/{platform}/{event_id}/
  source.html        # or source.json/source.pdf exactly as fetched
  metadata.json      # URL, fetch time, content type, encoding, language hints
```

Parsers should store normalized values in `sailing_data.db`, but source-specific
raw labels should remain recoverable from the raw files. If the schema is
extended later, prefer adding explicit `*_raw`, `source_language`, and
`translated_*` columns or a separate translation table instead of mutating
existing normalized columns in place.

## Priority Sources

### Phase EU-1: manage2sail

**Why:** Common across European championships and class events, with public
event pages and downloadable result reports.

**Likely data shape:**
- Event pages with classes/fleets, entries, notices, and result links.
- Downloadable result reports, often PDF or generated report endpoints.
- Names, sail numbers, clubs, nations, classes, race scores, totals, and ranks.

**Implementation notes:**
- Start with a small curated seed list of public event URLs.
- Preserve original reports before extraction, especially PDFs.
- Build extraction around stable report/download URLs only after confirming
  access policy and robots behavior.
- Treat nation codes as structured data, not translations.

### Phase EU-2: Sailwave Published Results

**Why:** Sailwave is widely used by clubs and championships internationally,
including Europe. Published result pages are often static HTML and have a
recognizable table structure.

**Likely data shape:**
- Static HTML files in club folders or on `sailwave.com/results`.
- Tables with rank, fleet/class, sail number, helm, crew, club, race columns,
  total, nett, and scoring codes.

**Implementation notes:**
- This is the best first parser candidate because the input is often static
  HTML and easy to preserve.
- Do not assume column names are English. Build a header synonym map while also
  saving the original header text.
- Keep race-cell text exactly as shown because discard markers, scoring codes,
  and localized labels may be meaningful.

### Phase EU-3: RegattaBase

**Why:** RegattaBase aggregates German-speaking sailing results, sailors, clubs,
and regattas, and is a strong European index candidate.

**Likely data shape:**
- Regatta pages with event metadata, clubs, entries, and results.
- Sailor and club profile pages that may help identity resolution.

**Implementation notes:**
- Treat this first as a discovery/index source, then decide whether to parse
  result detail directly or follow outbound official result links.
- German labels should be preserved raw; normalized English field names should
  be parser internals only.

### Phase EU-4: SailingResults.net

**Why:** Public sailing result and entry platform used by clubs and larger
regattas.

**Implementation notes:**
- Evaluate access patterns before writing a broad harvester.
- Start with explicitly seeded public result pages.

### Phase World-1: World Sailing / Class Association Results

**Why:** Adds non-US championships and provides high-value international sailor,
nation, and class context.

**Implementation notes:**
- Prefer official public result documents and class association archives.
- Many sources are PDFs; preserve originals and extract into derived tables.

## Parser Requirements

Every international parser should:

- Use UTF-8 internally and preserve the source bytes on disk.
- Record the platform, source URL, source language, and parser version in logs
  or metadata.
- Save original column headers and labels before mapping them to canonical
  fields.
- Keep original names, clubs, venues, and event titles unchanged in canonical
  records unless a separate normalized field already exists.
- Store translations only in derived fields or separate metadata structures.
- Add tests or verification samples with non-English headers and diacritics.

## Recommended Development Order

1. Create a curated seed file for European sources with source URL, platform,
   country, language hint, and notes.
2. Build a Sailwave static HTML parser against 5-10 saved European result pages.
   First-pass scripts exist as `ingestion/sailwave_harvester.py` and
   `ingestion/sailwave_parser.py`.
3. Build a manage2sail discovery/report harvester for seeded events.
4. Add a translation/normalization metadata table only after at least two
   multilingual sources prove what fields need it.
5. Expand to RegattaBase as a discovery layer for German-speaking events.

Initial seeds live in `data/source_seeds/europe.csv`. Keep this file curated and
small; broad crawling rules should be added only after the source structure and
access policy are understood.

Worldwide seeds live alongside it in `data/source_seeds/worldwide.csv`. The
Sailwave harvester reads every CSV in `data/source_seeds/`, deduplicates URLs,
and only fetches rows with `platform=Sailwave`.

Current first-pass coverage includes parsed Sailwave HTML/PDF results from Great
Britain, Australia, New Zealand, Taiwan, Brazil, the United Arab Emirates, and
South Africa. PDFs are parsed conservatively: exact extracted text is preserved
in `source_text`, and boat/race-result rows are created only where ranked result
lines can be detected.
