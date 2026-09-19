# Issue 1 Beta Launch Runbook

This runbook guides the operator through starting local infrastructure, applying the final migrations, executing the smoke test sequence, and publishing the Issue 1 beta.

---

## Prerequisite Services

Ensure PostgreSQL and Redis are running:

```powershell
# 1. Start PostgreSQL (Windows Service or CLI)
Start-Service postgresql*   # if installed as a service
# or manually via pg_ctl:
# & "C:\Program Files\PostgreSQL\<version>\bin\pg_ctl.exe" start -D "C:\Program Files\PostgreSQL\<version>\data"

# 2. Start Redis
# Start redis-server inside WSL or via native Windows port.
```

---

## Step 1: Apply Pending Migrations

Apply the migration scripts to add the `run_mode` column to both the newsletter and social runs tables:

```powershell
npx tsx scripts/apply-migration.ts 030_newsletter_edition_run_mode.sql
npx tsx scripts/apply-migration.ts 031_social_runs_run_mode.sql
```

---

## Step 2: Pre-Beta Smoke Test Sequence

Run the following scripts sequentially to verify operational readiness:

### 1. Sample Edition Compile
Checks candidate selection, section assignment, slot generation, and run isolation.
```powershell
npx tsx scripts/compile-edition.ts --sample
```
- **Verify:** Expected to select ~30 candidates and ~13 sections. A boxed warning banner "SAMPLE RUN" should appear. No production candidates are marked as used.

### 2. Newsletter Email Generation (Dry Run)
Checks email content formatting and Gemini model (gemini-2.5-flash) generation.
```powershell
npx tsx scripts/generate-daily-newsletter.ts --dry-run
```
- **Verify:** Produces human-readable sectioned email contents (~9k-10k characters). No actual email is broadcast.

### 3. Micro-Edition Generation (Dry Run)
Checks social-edition formatting and platform character limits (e.g. Mastodon 500, Bluesky 300).
```powershell
npx tsx scripts/generate-micro-edition.ts --dry-run
```
- **Verify:** Character validation badges and dry-run indications show up. No posting occurs.

### 4. Admin Dashboard Routes & Visibility
1. Visit the admin dashboard and navigate to the **Readiness** surface.
2. Confirm the credential cards update accurately (e.g. Gemini, Resend, Wayback are active; GA4 & Social display clear configurations needed status).
3. Visit the **Scheduler** surface. Verify the 4 repeatable windows (5am, 11am, 5pm, 11pm CT) calculate next runs correctly.

### 5. Live Compile (Sample Run)
Run a full end-to-end sample run:
```powershell
npx tsx scripts/compile-edition.ts --sample
npx tsx scripts/generate-daily-newsletter.ts --dry-run
```
Go to the admin dashboard's **Publishing Runs** tab and verify the run is recorded with `run_mode = 'sample'` and timestamps are accurate.
