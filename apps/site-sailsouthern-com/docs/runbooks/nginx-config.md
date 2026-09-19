# Nginx Configuration Runbook

## Rate Limit Zones

Defined in `/etc/nginx/conf.d/rate-limits.conf` (file: `infra/nginx/rate-limits.conf`):

| Zone | Applies to | Rate | Burst |
|---|---|---|---|
| `sendit_zone` | `/sendit/` | 120 req/min/IP | 20 |
| `api_zone` | `/api/` | 60 req/min/IP | 20 |
| `admin_zone` | `/api/admin/` | 10 req/min/IP | 5 |

All rate-limited locations return **HTTP 429** on violation (not 503).

## Location Priority (api.sailsouthern.com)

Nginx matches locations in specificity order:

1. `= /health` — no rate limit, 5s timeout (uptime monitors)
2. `/sendit/` — 120/min, fast 5s timeout
3. `/api/admin/` — 10/min, includes `x-admin-api-key` CORS header
4. `/api/` — 60/min, general API
5. `/` — fallback, no additional rate limit

## Deploying Config Changes

```bash
# 1. Copy configs to server
rsync -av infra/nginx/ root@67.205.162.200:/etc/nginx/sites-available/
rsync -av infra/nginx/rate-limits.conf root@67.205.162.200:/etc/nginx/conf.d/

# 2. Test configuration
ssh root@67.205.162.200 nginx -t

# 3. Reload (zero-downtime)
ssh root@67.205.162.200 systemctl reload nginx
```

## Testing Rate Limits

```bash
# Test sendit rate limit (should get 429 after 20 rapid requests)
for i in $(seq 1 25); do curl -s -o /dev/null -w "%{http_code}\n" https://api.sailsouthern.com/sendit/TESTHASH; done

# Test health endpoint (should always be 200)
curl https://api.sailsouthern.com/health
```

## Notes

- Rate zone memory: `api_zone:10m`, `admin_zone:5m`, `sendit_zone:10m` — sufficient for millions of IPs
- `nodelay` means burst requests are served instantly (not queued with delay)
- Certbot manages SSL certs — do not edit `ssl_certificate` lines manually
