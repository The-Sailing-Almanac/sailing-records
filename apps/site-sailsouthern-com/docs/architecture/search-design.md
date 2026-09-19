# Search Design

## Filter Applied to Public Search

All requests to `GET /api/search?q=` apply the following filter:

```
is_suppressed = FALSE AND relevance_score > 0.1
```

### Meilisearch (primary path)

Filter is passed as a `filter` field in the POST body to `/indexes/article_links/search`:

```json
{
  "q": "<query>",
  "limit": 10,
  "filter": "is_suppressed = false AND (relevance_score > 0.1 OR relevance_score IS NULL)"
}
```

> **Note on `IS NULL` in filter**: Articles ingested before relevance scoring was added may have `relevance_score = NULL`. We include them (`OR relevance_score IS NULL`) rather than hiding fresh, unscored content.

### Postgres ILIKE fallback

When Meilisearch is unavailable, the endpoint falls back to:

```sql
SELECT id, canonical_url, title, publisher_name, published_at
FROM article_links
WHERE title ILIKE $1
  AND is_suppressed = false
  AND (relevance_score > 0.1 OR relevance_score IS NULL)
ORDER BY published_at DESC
LIMIT 10
```

## Re-indexing after Filter Change

If the Meilisearch index was bootstrapped without these filterable attributes:

```bash
# Re-bootstrap the index with correct filterable attributes
npm run bootstrap-search

# Re-index all eligible articles
npm run index-articles
```

`bootstrap-search.ts` sets `filterableAttributes: ['is_suppressed', 'relevance_score', ...]` on the index.

## Relevance Score Distribution

Articles are stored regardless of score. Suppression and score are the public-facing gate:

| Score range | Display |
|---|---|
| > 0.7 | High relevance — shown prominently |
| 0.4-0.7 | Medium — shown normally |
| 0.1-0.4 | Low — shown in search, de-ranked |
| <= 0.1 | Very low — hidden from public search |
| NULL | Unscored — included (treated as new) |
| is_suppressed = true | Always hidden |
