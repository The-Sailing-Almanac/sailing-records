# Handoff: Phase 11 Beta Launch Verification

```yaml
phase: 11
batch_id: ss-phase-11-issue-1-beta-launch
date: 2026-05-29
status: blocked

database_status: blocked
migrations_status: blocked
smoke_test_status: skipped

go_no_go: NO-GO
recommended_scenario: B
blocking_issues:
  - "Database port 5432 is not listening (ECONNREFUSED)"
  - "Redis port 6379 is not listening (ECONNREFUSED)"

tests_passing: 73/74
typescript: clean

credential_status:
  critical:
    - name: GEMINI_API_KEY
      status: set
      verified: untested
    - name: RESEND_API_KEY
      status: set
      verified: untested
    - name: Domain verification
      status: missing
      verified: no
      note: "Email sending domain setup is pending operator DNS configuration."

  important:
    - name: GA4_MEASUREMENT_ID
      status: missing
    - name: GA4_API_SECRET
      status: missing
    - name: MASTODON_INSTANCE_URL
      status: missing
    - name: MASTODON_ACCESS_TOKEN
      status: missing
    - name: NOSTR_PRIVATE_KEY
      status: missing
    - name: NOSTR_RELAYS
      status: missing
    - name: BLUESKY_IDENTIFIER
      status: missing
    - name: BLUESKY_PASSWORD
      status: missing

  nice-to-have:
    - name: GA4_PROPERTY_ID
      status: missing
    - name: LIGHTNING_ADDRESS
      status: missing
    - name: BOLT12_OFFER
      status: missing
    - name: WAYBACK_ACCESS_KEY
      status: set
      verified: yes
    - name: WAYBACK_SECRET_KEY
      status: set
      verified: yes

smoke_test_results:
  - test: Sample Edition Compile
    status: skipped
    notes: "Requires database access to select candidates."
  - test: Newsletter Email Generation (Dry Run)
    status: skipped
    notes: "Requires database access to load candidate pool."
  - test: Micro-Edition Generation (Dry Run)
    status: skipped
    notes: "Requires database access to load candidate pool."
  - test: Readiness Surface Verification
    status: skipped
    notes: "Requires database access/API runtime connection."
  - test: Scheduler Surface Verification
    status: skipped
    notes: "Requires Redis connection to query BullMQ queue states."
  - test: Route Verification
    status: skipped
    notes: "Requires active database connection for archive and latest routes."
  - test: Full Live Compile (Sample Mode, End-to-End)
    status: skipped
    notes: "Requires database and Redis connectivity."

discovered_issues:
  - description: "Local PostgreSQL database connection (localhost:5432) returns ECONNREFUSED."
    severity: critical
    blocks_beta: yes
    fix_estimate: "15 minutes (Operator task: Start PostgreSQL service or process)"
  - description: "Local Redis connection (localhost:6379) returns ECONNREFUSED."
    severity: high
    blocks_beta: yes
    fix_estimate: "10 minutes (Operator task: Start Redis service or process)"

next_steps:
  operator:
    - "Start local PostgreSQL server on port 5432 (e.g. via pg_ctl or Windows Services)."
    - "Start local Redis server on port 6379."
    - "Run migrations: `npx tsx scripts/apply-migration.ts 030_newsletter_edition_run_mode.sql` and `npx tsx scripts/apply-migration.ts 031_social_runs_run_mode.sql`."
    - "Run the pre-beta smoke tests sequentially (see ops/beta-launch-runbook.md or instructions below)."
    - "Configure domain DNS settings for Resend (email sending domain)."
    - "Input GA4 measurement keys and social credentials in `.env` as they become active."
  ag:
    - "Once connectivity is restored, verify migrations and execute the Lane 2 smoke test sequence."

beta_launch_decision:
  recommendation: |
    Currently, the system is a NO-GO due to database and Redis connectivity failures (ECONNREFUSED). Once PostgreSQL and Redis are started, and migrations 030-031 are applied, we recommend Scenario B (Web + Email Beta) as the initial publishing path. Under Scenario B, Issue 1 can publish via Web and Resend email campaign, while social platform configurations (Mastodon, Nostr, Bluesky) can proceed in Phase 12.
  
  timeline: |
    Blockers must be resolved first:
    1. Start PostgreSQL & Redis services.
    2. Apply migrations 030 and 031.
    3. Run smoke test sequence successfully.
```

---

## Detailed Blockers and Action Plan

### 1. Database Connection Blocker
The Postgres connection to `localhost:5432` is returning `ECONNREFUSED`. Because of this:
- Pending migrations 030 and 031 could not be applied.
- The compilation, newsletter, and micro-edition scripts (even with `--dry-run` or `--sample`) cannot connect to query articles.
- The admin dashboard's readiness page is unreachable.

**Remediation Steps for Operator:**
1. Check if PostgreSQL is installed locally. If running on Windows, verify via Services app or start manually:
   ```powershell
   # If installed as a Windows service, try:
   Start-Service postgresql*
   # Or locate pg_ctl in your installation path:
   & "C:\Program Files\PostgreSQL\<version>\bin\pg_ctl.exe" start -D "C:\Program Files\PostgreSQL\<version>\data"
   ```
2. Once Postgres is started, run the migrations:
   ```powershell
   npx tsx scripts/apply-migration.ts 030_newsletter_edition_run_mode.sql
   npx tsx scripts/apply-migration.ts 031_social_runs_run_mode.sql
   ```

### 2. Redis Connection Blocker
Redis connection to `localhost:6379` is returning `ECONNREFUSED`, which causes the single failing unit test (`submissions.test.ts` timeout) and prevents the BullMQ queues from running.

**Remediation Steps for Operator:**
1. Start the Redis server:
   ```powershell
   # e.g., if Redis is installed via WSL or native Windows:
   redis-server
   ```
2. Verify Redis is running using `redis-cli ping`.
