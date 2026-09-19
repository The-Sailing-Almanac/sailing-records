# Runbook: Meilisearch Index Bootstrap

## Purpose

Create and configure the `article_links` Meilisearch index before bulk indexing or enabling the Sprint 5 SearchBar.

## Prerequisites

- `almanac-search` container running (`infra/docker/docker-compose.yml`)
- `.env` contains `MEILI_HTTP_ADDR` and `MEILI_MASTER_KEY`
- Postgres `article_links` populated

## Steps (chantecler-01)

```bash
cd ~/ss-sailsouthern-com
git pull
npm install
npm run bootstrap-search
```

Expected log lines:

- Index `article_links` created or confirmed
- Filterable, sortable, and searchable attributes applied
- Index stats printed (document count may be 0 before indexing)

## Bulk index

```bash
# Full corpus (optional baseline)
npm run index-articles

# Public search corpus (post quality pass)
npm run index-articles -- --public-only
```

## Verify

```bash
curl -s "${MEILI_HTTP_ADDR}/indexes/article_links/stats" \
  -H "Authorization: Bearer ${MEILI_MASTER_KEY}"
```

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| Connection refused | `docker ps` — start `almanac-search` |
| 403 / invalid key | Match `MEILI_MASTER_KEY` in `.env` and compose |
| Missing columns during index | Apply migrations `005` and `006` first |
