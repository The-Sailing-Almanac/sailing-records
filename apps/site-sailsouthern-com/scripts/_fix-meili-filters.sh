#!/bin/bash
# Fix Meilisearch filterable attributes to include relevance_score
: "${MEILI_MASTER_KEY:?MEILI_MASTER_KEY is required}"
MEILI_URL="http://localhost:7700"

echo "=== Updating filterable attributes ==="
TASK=$(curl -s -X PUT "${MEILI_URL}/indexes/article_links/settings/filterable-attributes" \
  -H "Authorization: Bearer ${MEILI_MASTER_KEY}" \
  -H "Content-Type: application/json" \
  --data-raw '["domain","is_archived","is_flagged","is_suppressed","language","moderation_state","source_family_id","relevance_score","published_at"]')
echo "Response: $TASK"

TASK_ID=$(echo "$TASK" | python3 -c "import sys,json; print(json.load(sys.stdin).get('taskUid',''))")
echo "Task UID: $TASK_ID"

if [ -n "$TASK_ID" ]; then
  echo "Waiting for task to complete..."
  sleep 5
  -H "Authorization: Bearer ${MEILI_MASTER_KEY}"
  echo "Task status: $STATUS"
fi

echo ""
echo "=== Testing search ==="
sleep 2
curl -s -X POST "${MEILI_URL}/indexes/article_links/search" \
  -H "Authorization: Bearer ${MEILI_MASTER_KEY}" \
  -H "Content-Type: application/json" \
  --data-raw '{"q":"regatta","limit":3,"filter":"is_suppressed = false AND relevance_score > 0.1"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'hits' in d:
    print('SUCCESS - hits:', len(d['hits']))
    for h in d['hits'][:2]:
        print(' -', h.get('title','?')[:60])
else:
    print('ERROR:', d)
"
