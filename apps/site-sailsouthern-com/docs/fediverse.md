---
title: "Fediverse / GoToSocial Setup"
updated_at: "2026-06-08"
type: reference
---

# Fediverse Setup — social.sailingalmanac.org

## What It Is

Self-hosted GoToSocial instance running on chantecler-01. GoToSocial implements ActivityPub + the Mastodon API — fully interoperable with Mastodon, Pixelfed, and the broader Fediverse. Single lightweight Go binary (no Ruby, no Sidekiq, ~100MB RAM).

## Handle

```
@sailingalmanac@social.sailingalmanac.org
```

## Instance Details

| Field | Value |
|-------|-------|
| URL | https://social.sailingalmanac.org |
| Version | v0.21.2+git-343fed2 |
| DB | SQLite at `/home/aewoodyard/gotosocial-data/sqlite.db` |
| Storage | `/home/aewoodyard/gotosocial-data/` |
| Container | `gotosocial` (Docker, `unless-stopped`) |
| Internal port | `127.0.0.1:8080` |
| Nginx proxy | `social.sailingalmanac.org` → localhost:8080 |
| SSL | Let's Encrypt (auto-renewed) |

## Admin Account

| Field | Value |
|-------|-------|
| Username | `sailingalmanac` |
| Email | `hello@sailsouthern.com` |
| Password | stored at `/tmp/gts-account-password.txt` on chantecler-01 |
| Role | admin + moderator |
| Admin panel | https://social.sailingalmanac.org/admin |

## OAuth App (for API posting)

| Field | Value |
|-------|-------|
| client_id | `01DEFANSW86CAXXPTKE3284N14` |
| client_secret | stored at `/tmp/gts-app.env` on chantecler-01 |
| scopes | `read write` |

## OAuth Authorization Flow (one-time, browser required)

GoToSocial does not support password grant. Access token requires a one-time browser authorization:

1. Open this URL in a browser (logged in as sailingalmanac):
   ```
   https://social.sailingalmanac.org/oauth/authorize?client_id=01DEFANSW86CAXXPTKE3284N14&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=read+write
   ```
2. Click **Authorize**
3. Copy the displayed authorization code
4. Exchange code for token on chantecler-01:
   ```bash
   source /tmp/gts-app.env
   curl -s -X POST https://social.sailingalmanac.org/oauth/token \
     -d "client_id=$GTS_CLIENT_ID" \
     -d "client_secret=$GTS_CLIENT_SECRET" \
     -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob" \
     -d "grant_type=authorization_code" \
     -d "code=PASTE_CODE_HERE"
   ```
5. Save the returned `access_token` to chantecler-01 `.env` as `MASTODON_ACCESS_TOKEN`
6. Set `MASTODON_INSTANCE_URL=https://social.sailingalmanac.org`

## Environment Variables (chantecler-01 .env)

```bash
MASTODON_INSTANCE_URL=https://social.sailingalmanac.org
MASTODON_ACCESS_TOKEN=   # from OAuth flow above
```

## Publishing Code

- `scripts/lib/mastodon.ts` — `publishMastodonStatus(text)` — simple status post
- `scripts/lib/social-adapters.ts` — `publishToMastodon(queryFn, accountId, content)` — full archival post with delivery logging
- Timer: `generate-daily-newsletter.ts` — needs to be wired into `deploy-timers.ts` as ExecStartPost after `gate-edition`

## DNS

`social.sailingalmanac.org` A record → `67.205.162.200` (chantecler-01, gray cloud / DNS-only in Cloudflare)

## Status

- [x] Instance running
- [x] SSL active
- [x] Account created + confirmed + admin
- [x] OAuth app created
- [ ] Access token — **pending browser OAuth completion**
- [ ] `MASTODON_ACCESS_TOKEN` added to chantecler-01 .env
- [ ] Social broadcast wired into timer chain
- [ ] Instance description and profile filled out
