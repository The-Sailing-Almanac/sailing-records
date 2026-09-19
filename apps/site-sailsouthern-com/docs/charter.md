# Sailing Almanac / Sail Southern STAX Charter

## Executive Direction
The primary shipping product of this repository is **the Sailing Almanac knowledgebase**, not the front-page newsletter layer. The initial system prioritizes ingesting sailing links and preserving structured tags around those links, starting with the most recent material and moving backward in time toward the beginning of 2025. The homepage newsletter remains a separately generated editorial product injected into the main page.

The long-term architecture is an **IMDb-for-sailing** entity graph with a custom public frontend. The later "Open Sailing Almanac" becomes a collaborative knowledge layer that sits downstream of the main data engine rather than defining it. The backend is built as a structured graph/content system with crawl orchestration, tagging, suppression, and archival workflows, not as a wiki-native platform.

---

## Confirmed Product Doctrine

### Core Products
1. **Sailing Almanac** — The main property: a structured, queryable, archival sailing intelligence system.
2. **Sail Southern** — A child editorial/news module focused on southern and Gulf-facing sailing coverage.
3. **Open Sailing Almanac** — A later collaborative reference layer with a custom frontend and submission workflow.
4. **Front-Page Newsletter Product** — Editorially generated and injected onto the main page, separate from the archival knowledgebase.

### Confirmed Editorial Boundaries
* **Classic Boats**: Defined as boats built **pre-1970**.
* **Design & Make/Model Nodes**: One-design class nodes and make/model nodes are **separate nodes with strong links**.
* **Cruising Rallies**: Kept **separate from regattas**, but strongly linked to performance cruising and cruiser-racer categories.
* **Windsurfing & Kiteboarding**: Receive **first-class coverage**.
* **Charter & Superyachts**: In-scope for coverage.
* **Out of Scope**: General vacation-cruises and commercial freight-shipping content.
* **Operating Language**: **English-first** initially, preserving the architecture for later multilingual growth.

---

## STAX North-Star Outcome
The target system is a continuously updated sailing graph in which:
* Every article link is ingested as a first-class record.
* Every link is associated with structured entities, tags, source metadata, archive status, and moderation state.
* Every entity accumulates articles, records, references, and user submissions over time.
* Every high-value node intersection generates a dedicated page and RSS feed.
* Crawling, source weighting, and suppression evolve from ongoing signals rather than brittle static rules.

The knowledgebase is not a blog with tags; it is a **sailing reference operating system** with an editorial shell.

---

## Phase Map

### Phase 0 — Charter, Schema Lock, and Repo Foundation (Current)
Establish the canonical architecture, schema vocabulary, repo layout, and operating doctrine before crawler implementation begins.

### Phase 1 — Link Knowledgebase MVP
Ship a working system that can:
* Ingest URLs from feeds and manual entry.
* Fetch and normalize article metadata.
* Deduplicate links.
* Classify likely sailing relevance.
* Attach tags/entities.
* Archive minimal content copies where allowed.
* Expose a searchable admin view and a public-facing read layer.

### Phase 2 — Crawling Bot Fleet
Design and deploy specialized bot families (Feed Ingestors, Site Crawlers, Taxonomy Discovery, Entity Extraction, Archive, Source Intelligence, and Submissions).

### Phase 3 — Source Intelligence and Rule Engine
Turn feeds, source families, and human/operator signals into a durable adaptive control layer with soft inheritance and overrides.

### Phase 4 — Entity Graph and Public Pages
Stand up the Sailing Almanac graph model and public entity pages (IMDb-style pages for classes, sailors, regattas, locations, etc.).

### Phase 5 — Search, Intersections, and Custom Feeds
Deploy Meilisearch/Typesense/OpenSearch for fast lookup, autocomplete, and dynamic page generation for node combinations (with RSS generation).

### Phase 6 — Submission System
Allow readers to contribute links, facts, and corrections under a v1 cap (600 words, up to 3 supporting files).

### Phase 7 — Archive and Preservation Layer
Reduce link rot via local snapshots and external Internet Archive triggers. Includes the Outbound Social Archive + Dashboard workstream to preserve our own outbound social posts from day one in structured form.

### Phase 8 — Frontend and Editorial Surface
Build the public web interface for Sailing Almanac, the Sail Southern child module, and the home-page newsletter injector.

### Phase 9 — Open Sailing Almanac
Launch the collaborative layer (custom frontend, not MediaWiki) using Wikipedia-derived seeds.

### Phase 10 — Records Integration
Tie the future Sailing Records project (fastest passages, championships, records) into the knowledge graph.

### Phase 11 — International Expansion
Extend alias namespaces and languages, keeping the parent name compatible with global locales.
