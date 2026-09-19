# Entity Graph Architecture

## Overview
The Entity Graph links articles, authors, regattas, yacht clubs, classes, and geographic entities together. Every time a new article is crawled and ingested, it is parsed by a Gemini-based Named Entity Recognition (NER) worker to extract entities.

```
                    ┌──────────────┐
                    │ Article Link │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │Entity Mention│
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │    Entity    │
                    └──────────────┘
```

## Database Schema

### `entities`
Stores unique canonical entities (e.g. sailors, yacht clubs, boat classes).
- `id` (SERIAL)
- `canonical_name` (TEXT)
- `aliases` (TEXT[])
- `entity_type` (TEXT) - e.g. `sailor`, `club`, `regatta`, `class`, `location`
- `slug` (TEXT UNIQUE)
- `dominant_color` (TEXT) - Hex color for UI styling
- `meta` (JSONB)

### `entity_mentions`
Maps article links to entities with context-specific metadata.
- `id` (SERIAL)
- `article_link_id` (UUID REFERENCES article_links)
- `entity_id` (INT REFERENCES entities)
- `confidence_score` (FLOAT)
- `extracted_at` (TIMESTAMPTZ)

## Entity Extraction Workflow
1. **Trigger**: When the feed poller finds a new article, it inserts the record into `article_links` and enqueues a job in the `entityExtractionQueue`.
2. **Worker**: The `entityExtractorWorker` processes jobs from BullMQ.
3. **Gemini Parsing**: The worker sends the article title and snippet to the Gemini API (`gemini-2.5-flash`), asking it to extract entities matching our types.
4. **Resolution**: The worker matches extracted entity names against the `entities` table using a fuzzy/alias-matching SQL lookup. If a match is found, an `entity_mentions` row is created.

## Dynamic Page Generation
Entities are exposed on the website under dynamic routes:
- `/entities/[slug]` — Displays details about the entity, dynamic biographical or info cards styled using its `dominant_color`, and a list of all articles mentioning the entity.
- `/builder` — Allows the user to select multiple entities and compile a custom combined RSS feed from their combined article streams.
