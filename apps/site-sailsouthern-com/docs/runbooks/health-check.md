# Health Check Runbook

## Endpoint

```
GET /health
```

No authentication required. Used by nginx, uptime monitors (UptimeRobot, BetterUptime, etc.).

## Response

**Healthy (HTTP 200):**
```json
{
  "status": "ok",
  "db": "ok",
  "search": "ok",
  "timestamp": "2026-05-28T17:00:00.000Z"
}
```

**Degraded (HTTP 503):**
```json
{
  "status": "degraded",
  "db": "error",
  "search": "ok",
  "timestamp": "2026-05-28T17:00:00.000Z"
}
```

- `status` is `"ok"` only if both `db` and `search` are `"ok"`
- `status` is `"degraded"` if either service is down
- HTTP status code is `200` if DB is up, `503` if DB is down

## Checks Performed

| Check | Method | Timeout |
|---|---|---|
| PostgreSQL | `SELECT 1` | pg pool timeout (10s default) |
| Meilisearch | `GET /health` on MEILI_HTTP_ADDR | 2 seconds |

## Monitoring Setup

Add to UptimeRobot / BetterUptime:
- URL: `https://api.sailsouthern.com/health`
- Method: GET
- Expected HTTP status: 200
- Check interval: 5 minutes
- Alert: Slack #alerts + Telegram + Discord (via `notifications.ts`)

## Nginx Config

The `/health` location has no rate limit and a short `proxy_read_timeout 5s`:

```nginx
location = /health {
    proxy_pass http://127.0.0.1:4000;
    proxy_read_timeout 5s;
    # ... headers
}
```

## Manual Check

```bash
curl https://api.sailsouthern.com/health | jq
```
