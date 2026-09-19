# Redirect System Operation Runbook

## Purpose
This runbook guides operators on configuring, backfilling, and verifying the `/sendit/<hash>` redirection and tracking system. The redirect system deterministically hashes external article URLs and records clicks in the `redirect_clicks` database table for analytics.

## Prerequisites
- PostgreSQL 16 database running and accessible.
- API and Web apps built and running.
- Node.js (v18+) with `tsx` installed.

## Step-by-Step Instructions

### Step 1: Run Redirect System Database Migration
Ensure the redirect schema is applied to the PostgreSQL database.
```bash
npx tsx scripts/apply-migration.ts 008_redirect_system.sql
```

### Step 2: Backfill Redirect Hashes
For historical articles, backfill redirect hashes in batches:
```bash
# Run with default settings
npm run generate-redirect-hashes

# Run with a custom batch size
npm run generate-redirect-hashes -- --batch=5000
```

### Step 3: Configure Rate Limits in Nginx
Ensure Nginx is rate limiting the `/sendit` routes.
Add the following zone to `nginx.conf`:
```nginx
limit_req_zone $binary_remote_addr zone=sendit_zone:10m rate=120r/m;
```
Inside the server block:
```nginx
location /sendit/ {
    limit_req zone=sendit_zone burst=20 nodelay;
    proxy_pass http://localhost:4000;
}
```
Reload Nginx:
```bash
sudo systemctl reload nginx
```

## Example Commands
- Run backfill script:
  ```bash
  npx tsx scripts/generate-redirect-hashes.ts
  ```

## Verify It Worked
1. Perform a manual redirection request using curl:
   ```bash
   curl -i http://localhost:4000/sendit/3a7f91bc?src=web
   ```
2. Verify you receive an HTTP `302 Found` response pointing to the canonical URL of the article.
3. Check the database to confirm the click was tracked:
   ```sql
   SELECT * FROM redirect_clicks ORDER BY clicked_at DESC LIMIT 1;
   ```
   Verify that `ip_hash` is a SHA-256 string (never raw IP) and `source` matches `web`.
