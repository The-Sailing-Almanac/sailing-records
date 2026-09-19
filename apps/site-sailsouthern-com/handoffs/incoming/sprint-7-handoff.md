# Sprint 7 Handoff — Almanac / SailSouthern

## Status Overview
We are in the middle of **Sprint 7**. The primary objective of this phase is database verification, Next.js deployment, feed validation, and enabling SSL for `sailsouthern.com`.

---

## 💻 Server & Environment Status (`chantecler-01`)
- **Port Layout:**
  - Next.js Frontend: Port `3002` (Systemd: `almanac-web.service`)
  - Express API: Port `4000` (Systemd: `almanac-api.service`)
  - Ingest Daemon: (Systemd: `almanac-ingest.service`)
  - Meilisearch: Port `7700` (`almanac-search` Docker container)
  - PostgreSQL: Port `5432` (`almanac-db` Docker container)
- **Active Environment Keys:**
  - `MEILI_MASTER_KEY`: Rotated to `${MEILI_MASTER_KEY}` (Search index connection working fine)
  - `ADMIN_API_KEY`: Set to `${ADMIN_API_KEY}`

---

## ✅ Completed This Sprint
1. **DB Migrations 005 & 006** are fully applied and verified in the database.
2. **Meilisearch Search Logic Fixed:** `is_suppressed` and `relevance_score` were added to `filterableAttributes` via Meilisearch API. The API no longer falls back to Postgres (`source: meilisearch` confirmed).
3. **Next.js Frontend Deployed:** Running locally on port `3002` via systemd (`almanac-web`).
4. **Nginx Conf Added:** HTTP proxy at `infra/nginx/sailsouthern.com.conf` pointing `sailsouthern.com` to port `3002`.
5. **Feed Validation Completed:** `docker logs almanac-feed-validator` confirms `unvalidated` feeds is now **0**.
   - Active Feeds: `200`
   - Dead/Inactive Feeds: `20,730`

---

## ⏳ Immediate Next Steps (Incoming Agent)

### 1. Issue SSL Certificate & Configure HTTPS
Once the user has updated the Cloudflare DNS records to point `sailsouthern.com` and `www.sailsouthern.com` to chantecler-01 (`67.205.162.200`):
1. SSH into the server:
   ```bash
   ssh aewoodyard@chantecler-01
   ```
2. Obtain the Let's Encrypt certificates via certbot:
   ```bash
   sudo certbot --nginx -d sailsouthern.com -d www.sailsouthern.com
   ```
3. Update the production nginx config:
   - Make sure `infra/nginx/sailsouthern.com.conf` in the repo matches the SSL settings certbot injects.
   - Reload Nginx: `sudo systemctl reload nginx`

### 2. Enable Live Feed Poller (Sprint 7C)
Now that feed validation is done, enable the ingest daemon to poll only the verified active feeds:
- Update query filters/daemon code to run ingest jobs targeting `is_active = true AND last_checked_at IS NOT NULL` (filtering out dead endpoints).

### 3. Gemini Relevance Enrichment Worker (Sprint 7B)
Build/configure the worker to batch-process the ~340k articles with near-zero relevance scores, leveraging Gemini to perform semantic rescoring (target score range `0.1` - `0.7`).
