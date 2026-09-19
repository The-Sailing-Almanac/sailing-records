# Bot Fleet Matrix

This matrix outlines the primary bot families responsible for populating, tag-enriching, and maintaining the Sailing Almanac.

---

## 🤖 Bot Families Definition Table

| Bot Family | Phase | Inputs | Outputs | Execution Trigger | Default Cadence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Feed Ingestors** | v1.0 (MVP) | RSS/Atom feeds, webhooks, JSON feeds | Discovered URL payloads | Cron-scheduled crawler job | Every 15 - 30 minutes |
| **2. Site Crawlers** | v1.5 | Unstructured HTML sections, site paginations | Discovered URL payloads, crawl metrics | Queue job (domain specific) | Daily to Weekly |
| **3. Taxonomy Discovery** | v2.0 | Directories (US/World Sailing, class databases) | New Entity Nodes (Classes, Clubs, Builders) | Scheduled cron job | Monthly |
| **4. Entity Extraction**| v1.0 (MVP) | Extracted clean text, database entity index | Suggested tags, entity linkages | Ingestion pipeline event | Immediate on fetch |
| **5. Archive Bots** | v1.5 | Discovered URL HTML payloads | Clean text snapshots, IA archive links | Post-extraction pipeline event | Async queue (30m delay) |
| **6. Source Intelligence**| v2.0 | Ingestion failure logs, relevance scores | Adjusted source priorities, probation flags| Observation run | Weekly |
| **7. Submission Bots** | v2.0 | User uploaded files, manual links | Sanitized submission records | User upload submission event | Immediate on upload |

---

## ⚙️ Detailed Bot Specifications

### 1. Feed Ingestors
* **Purpose**: Keep the link index updated with real-time news and blog posts.
* **Failure Modes**: 
  * Feed formatting changes (RSS parser crashes).
  * Rate-limiting or temporary outages of target feed server.
* **Retry Policy**: Retry twice after 5 minutes; if it continues to fail, disable the endpoint and notify the operator.
* **Observability**: Log total new links discovered per run. Track feed parse time.

### 2. Site Crawlers
* **Purpose**: Find articles on websites that lack RSS feeds or have incomplete feeds.
* **Politeness & Safety**: Always query `/robots.txt` first. Cap max depth at 3 hops. Throttle dynamically.
* **Failure Modes**: Circular loop redirect traps.
* **Retry Policy**: Do not retry redirects. Skip if connection fails more than twice.

### 3. Taxonomy Discovery Bots
* **Purpose**: Keep the directory of sailboat models, clubs, and governing organizations fresh.
* **Targets**: World Sailing lists, US Sailing club directories, GYA schedules.
* **Failure Modes**: Structure changes on the directory sites.
* **Observability**: Output a digest of proposed new nodes for administrative review; never auto-approve directory additions.

### 4. Entity Extraction Bots
* **Purpose**: Parse unstructured article text to link them to the right sailing entity.
* **Methodology**: Combined regex search for exact-match nodes (e.g. J/70, laser) + Named Entity Recognition (NER) for sailors, locations, and bodies of water.
* **Disambiguation Rules**:
  * If "J/70" is detected, map to Class `J/70` and Manufacturer `J/Boats`.
  * If "regatta" is present with "rally", classify as Regatta unless specific performance cruising keywords are dominant.
* **Failure Modes**: Excessive extraction (false entity linking).
* **Retry Policy**: Process locally; if failure occurs, dump payload to retry queue.

### 5. Archive Bots
* **Purpose**: Guard against link rot.
* **Tiers**:
  * **Local Snapshot**: Store sanitized HTML text in PostgreSQL or local disk storage.
  * **Internet Archive SPN**: POST url to `https://web.archive.org/save/` to trigger public indexing.
* **Failure Modes**: Paywalled sites blocking fetch.
* **Observability**: Track preservation percentages.

### 6. Source Intelligence Bots
* **Purpose**: Recalibrate crawl frequencies and flag spam domains.
* **Signals**: High frequency of travel-cruise keywords raises the `false_positive_score`.
* **Actions**: If a source's `false_positive_score` exceeds `0.75`, trigger dynamic suppression and flag for review.

### 7. Submission Bots
* **Purpose**: Sanitize user submissions.
* **Limits**: Cap text inputs at 600 words. Cap supporting attachments at 3 files, max 5MB each.
* **Sanitization**: Strip metadata from images (EXIF data) and run malware check before saving to archive disk.
