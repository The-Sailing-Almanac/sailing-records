#!/bin/bash
echo "=== Services ==="
systemctl is-active almanac-api almanac-ingest almanac-web

echo ""
echo "=== Search ==="
curl -s "http://localhost:4000/api/search?q=offshore+race" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('source:', d.get('source'), '| results:', len(d.get('results', [])))
"

echo ""
echo "=== Admin Stats ==="
curl -s -H "x-admin-api-key: $ADMIN_API_KEY" http://localhost:4000/api/admin/stats | python3 -c "
import sys, json
d = json.load(sys.stdin)
al = d['article_links']
fe = d['feed_endpoints']
print('articles:', al['total'], '| suppressed:', al['suppressed'])
print('feeds - total:', fe['total'], '| active:', fe['active'], '| dead:', fe['dead'], '| unvalidated:', fe['unvalidated'])
"

echo ""
echo "=== Docker ==="
docker ps --format "{{.Names}} {{.Status}}" | grep almanac

echo ""
echo "=== Feed Validator (last 3 lines) ==="
docker logs almanac-feed-validator --tail 3 2>&1

echo ""
echo "=== Meilisearch ==="
-H "Authorization: Bearer ${MEILI_MASTER_KEY}"
import sys, json
d = json.load(sys.stdin)
print('docs indexed:', d['numberOfDocuments'], '| indexing:', d['isIndexing'])
"
