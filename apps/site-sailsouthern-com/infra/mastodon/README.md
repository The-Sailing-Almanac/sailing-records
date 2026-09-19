# Mastodon Stack Deployment Guide

This directory provides the production deployment configuration for the **Sailing Almanac** federated front door, hosted at `social.sailingalmanac.org`.

## Prerequisite: Configuration Environment

Before booting the services, create an `.env.production` file in this directory. You can generate secrets using the Mastodon container:

```bash
docker-compose run --rm web bundle exec rake secret
```

Fill out the configuration below:

```ini
# --- Core Settings ---
LOCAL_DOMAIN=social.sailingalmanac.org
WEB_DOMAIN=social.sailingalmanac.org
SECRET_KEY_BASE=generate_with_secret_rake_task
OTP_SECRET=generate_with_secret_rake_task
VAPID_PRIVATE_KEY=generate_with_vapid_rake_task
VAPID_PUBLIC_KEY=generate_with_vapid_rake_task

# --- Database ---
DB_HOST=db
DB_USER=postgres
DB_NAME=mastodon_production
DB_PASS=secure_postgres_pass_change_me
DB_PORT=5432

# --- Redis ---
REDIS_HOST=redis
REDIS_PORT=6379

# --- SMTP Mail Configuration ---
# Use SMTP credentials from mailcow instance
SMTP_SERVER=mail.sailingalmanac.org
SMTP_PORT=587
SMTP_FROM_ADDRESS=notifications@sailingalmanac.org
SMTP_LOGIN=notifications@sailingalmanac.org
SMTP_PASSWORD=your_smtp_mailcow_password
SMTP_AUTH_METHOD=plain
SMTP_OPEN_SSL_VERIFY_MODE=peer
SMTP_ENABLE_STARTTLS=auto

# --- Storage ---
# Store files locally inside public_system volume (default)
# To use cloud backends (S3-compatible), configure here:
# S3_ENABLED=true
# S3_BUCKET=almanac-social-media
# AWS_ACCESS_KEY_ID=xxx
# AWS_SECRET_ACCESS_KEY=yyy
# S3_ALIAS_HOST=assets.sailingalmanac.org

# --- Registrations ---
# Disable open signups to keep this profile-only and quiet
SINGLE_USER_MODE=false
REGISTRATIONS_OPEN=false
```

---

## 1. First Boot & Database Schema Prep

Run the database setup script via docker-compose:

```bash
docker-compose run --rm web bundle exec rake db:setup
```

## 2. Compile Assets

If running in production, precompile the assets:

```bash
docker-compose run --rm web bundle exec rake assets:precompile
```

## 3. Start the Stack

Run in background mode:

```bash
docker-compose up -d
```

## 4. Create Brand Accounts

Create the canonical brand profile actor (`@almanac`):

```bash
docker-compose run --rm web bin/tootctl accounts create almanac \
  --email=admin@sailingalmanac.org \
  --role=admin \
  --confirmed
```

Create the child brand profile actor (`@sailsouthern`):

```bash
docker-compose run --rm web bin/tootctl accounts create sailsouthern \
  --email=editor@sailsouthern.com \
  --role=admin \
  --confirmed
```

## 5. Security & Verification

1. Access `https://social.sailingalmanac.org` in a browser.
2. Log into the administrative dashboard.
3. Verify that **Registrations are closed** (under Administration -> Settings -> Site Settings).
4. Verify email notifications by triggering a test email.
