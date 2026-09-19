# Runbook: Feed Validator Worker

## Purpose

Incrementally validate ~20k `feed_endpoints` rows via BullMQ without blocking live ingest. Marks feeds active/inactive based on HTTP response and RSS/XML shape.

## Prerequisites

- `almanac-db`, `almanac-redis` running
- Migration `006_feed_endpoint_quality.sql` applied
- `.env` with `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`

## Enable (Docker)

From repo root on chantecler-01:

```bash
cd ~/ss-sailsouthern-com/infra/docker
docker compose build almanac-feed-validator
docker compose up -d almanac-feed-validator
docker compose logs -f almanac-feed-validator
```

## Enable (systemd alternative)

Build worker, then run:

```bash
cd ~/ss-sailsouthern-com/workers/ingest
npm run build
node dist/feed-validator-main.js
```

## Behavior

- Enqueues batches of 50 feeds where `last_checked_at IS NULL`
- Max 10 concurrent HTTP checks per batch
- 10s timeout per URL
- Re-enqueues every 5 minutes until queue is empty
- Sets `http_status`, `is_active`, `validation_error`, `last_checked_at`

## Monitor progress

```sql
SELECT
  COUNT(*) FILTER (WHERE last_checked_at IS NULL) AS unvalidated,
  COUNT(*) FILTER (WHERE is_active = TRUE) AS active,
  COUNT(*) FILTER (WHERE is_active = FALSE AND last_checked_at IS NOT NULL) AS inactive
FROM feed_endpoints;
```

## Stop

```bash
docker compose stop almanac-feed-validator
```
