# Data Contracts Specification

This document defines the strict JSON data schemas and contracts for components communicating inside the Sailing Almanac.

---

## 🔗 Discovered URL Payload (Ingestion Input)

When a crawler or ingestor discovers a URL, it emits the following payload to the ingestion queue:

```json
{
  "$schema": "https://sailsouthern.com/schemas/discovered-url.v1.json",
  "discovered_url": "https://www.scuttlebuttsailing.com/2026/05/26/gulf-coast-j70-championships/",
  "canonical_url": "https://www.scuttlebuttsailing.com/2026/05/26/gulf-coast-j70-championships/",
  "source_domain": "scuttlebuttsailing.com",
  "feed_endpoint_id": "c4d3e2a1-0000-0000-0000-000000000000",
  "discovery_method": "rss_poll",
  "discovery_timestamp": "2026-05-27T22:13:00Z",
  "raw_payload": {
    "rss_title": "Gulf Coast J/70 Championships Decide Winners",
    "rss_pub_date": "2026-05-26T18:00:00Z",
    "rss_author": "John Doe",
    "rss_description": "Southern Yacht Club hosts the annual championship on Lake Pontchartrain."
  },
  "priority": 10
}
```

### Key Field Descriptions:
* `discovered_url`: The exact URL resolved during crawler crawling/polling.
* `canonical_url`: The normalized, tracking-cleaned URL (to check for duplicates).
* `priority`: Scheduling queue priority (higher priority runs first).

---

## 📝 Link Ingest & Metadata Record (Database Schema)

A fully ingested article link stores the following fields in the PostgreSQL database:

| Field Name | Data Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `url_hash` | VARCHAR(64) | SHA-256 fingerprint of the `canonical_url` (Unique Index) |
| `canonical_url` | TEXT | Cleaned URL |
| `title` | VARCHAR(255) | Article Title |
| `dek` | TEXT | Subtitle / Short Description (nullable) |
| `author` | VARCHAR(255) | Bylines / Author names (nullable) |
| `publisher_name` | VARCHAR(255) | Name of publishing site |
| `published_at` | TIMESTAMP | Original article publication date |
| `discovered_at` | TIMESTAMP | Date-time of first discovery |
| `language` | VARCHAR(5) | ISO 639-1 language code (e.g. `en`) |
| `region_guess` | VARCHAR(100) | Regional tag (e.g. `Gulf Coast`, `Chesapeake`) |
| `body_of_water` | VARCHAR(100) | Named body of water (e.g. `Lake Pontchartrain`) |
| `relevance_score` | FLOAT | System calculated relevance (`0.0` to `1.0`) |
| `negative_flags` | JSONB | Flag lists (`{"cruise": false, "freight": false}`) |
| `archive_status` | VARCHAR(50) | Status: `pending`, `locally_saved`, `ia_saved`, `failed` |
| `moderation_state`| VARCHAR(30) | State: `received`, `needs_review`, `approved`, `suppressed` |
| `extracted_text` | TEXT | Sanitized clean text extract |

---

## 🏷️ Extracted Entities & Tags Contract

After the entity extraction bot parses the fetched clean text, it produces a tagging payload:

```json
{
  "$schema": "https://sailsouthern.com/schemas/extracted-entities.v1.json",
  "article_link_id": "a9b8c7d6-1111-2222-3333-444455556666",
  "extraction_timestamp": "2026-05-27T22:15:00Z",
  "entities": [
    {
      "entity_type": "class",
      "canonical_id": "class_j70",
      "matched_text": "J/70",
      "confidence_score": 1.0,
      "disambiguation_action": "none"
    },
    {
      "entity_type": "club",
      "canonical_id": "club_southern_yacht_club",
      "matched_text": "Southern Yacht Club",
      "confidence_score": 0.98,
      "disambiguation_action": "map_to_location",
      "related_location_id": "loc_lake_pontchartrain"
    },
    {
      "entity_type": "regatta",
      "canonical_id": "regatta_gulf_coast_championships",
      "matched_text": "Gulf Coast Championships",
      "confidence_score": 0.92,
      "disambiguation_action": "differentiate_from_rally"
    }
  ],
  "suggested_tags": ["j70-racing", "gulf-coast-sailing", "lake-pontchartrain"],
  "model_confidence_metadata": {
    "engine": "ner-regex-hybrid-v1",
    "parser_version": "1.0.4"
  }
}
```

### Disambiguation Mechanics:
1. **Class vs. Make/Model**:
   * If matched text is `J/70`, tag both Class: `J/70` and Manufacturer: `J/Boats`.
   * If matched text is `Beneteau Oceanis 38`, map to Model: `Oceanis 38` and Manufacturer: `Beneteau`, but do not tag as a One-Design Class.
2. **Regatta vs. Rally**:
   * If "rally" is mentioned, check context. If it contains performance handicap classes (e.g. PHRF) and start times, rank it as a Regatta with rally attributes; if it is organized purely by a cruising association with no score reporting, categorize it as Rally.
