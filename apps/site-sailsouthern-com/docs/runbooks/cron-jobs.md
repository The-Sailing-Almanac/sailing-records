# Cron / systemd Timers Deployment and Administration Runbook

## Purpose
This runbook documents the deployment, scheduling, monitoring, and verification of all background jobs and automation tasks running via systemd timers on `chantecler-01`.

## Prerequisites
- Access to the `chantecler-01` server.
- Root or sudo privileges to manage systemd services and timers.
- Node.js environment configured on the server.

## Schedule Overview

All timers on the server are scheduled in UTC:

| Job | Command | UTC Schedule | Purpose |
|---|---|---|---|
| Morning edition compile | `compile-edition.ts --type daily` | `10:00 daily` | Compiles the main daily edition at 6:00 AM Eastern. |
| Archive previous edition | `archive-edition.ts` | `10:59 daily` | Archives the previous day's edition. |
| Noon injection | `inject-breaking.ts` | `17:00 daily` | Injects noon breaking news slot assignments. |
| 6pm injection | `inject-breaking.ts` | `23:00 daily` | Injects 6:00 PM breaking news slot assignments. |
| 11pm injection | `inject-breaking.ts` | `05:00` daily (+1 day) | Injects late-night news slot assignments. |
| Weekly edition | `compile-edition.ts --type weekly` | `Monday 10:00` | Generates the weekly recap edition. |
| Popularity score update | `update-popularity-scores.ts` | `Hourly` | Computes popularity rankings and override weights. |
| Gemini backfill | `enrich-relevance-gemini.ts --limit 5000 --model gemini-2.5-flash-lite` | `07:00 daily` | Runs Gemini-based relevance classification. |
| Heartbeat | `heartbeat.ts` | `*/30 * * * *` | Sends system telemetry updates. |
| Feed revalidation | `feed-validator worker` | `Sunday 03:00` | Validates dead or problematic RSS feed connections. |
| OG image backfill | `backfill-og-images.ts` | `08:00 daily` | Backfills missing `og_image_url` fields. |

## Deployment Instructions

Systemd timer unit files are defined under `/etc/systemd/system/`.

For each job, two files are created: a `.service` file defining the command, and a `.timer` file defining the schedule.

### Example configuration for `sailsouthern-daily-edition`:

`/etc/systemd/system/sailsouthern-daily-edition.service`:
```ini
[Unit]
Description=Sail Southern Daily Newsletter Edition Compiler
After=network.target

[Service]
Type=oneshot
WorkingDirectory=/var/www/sailsouthern
ExecStart=/usr/bin/npx tsx scripts/compile-edition.ts --type daily
Environment=NODE_ENV=production
User=almanac
```

`/etc/systemd/system/sailsouthern-daily-edition.timer`:
```ini
[Unit]
Description=Run Sail Southern Daily Newsletter Compiler Daily at 10:00 UTC

[Timer]
OnCalendar=*-*-* 10:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

### Activating the Timers
To apply any new or updated systemd configuration:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sailsouthern-daily-edition.timer
```

## Example Commands
- List all active timers on the system:
  ```bash
  systemctl list-timers --all
  ```
- View logs for a specific service:
  ```bash
  journalctl -u sailsouthern-daily-edition.service -n 50 --no-pager
  ```
- Trigger a service manually for testing:
  ```bash
  sudo systemctl start sailsouthern-daily-edition.service
  ```

## Verify It Worked
1. Run `systemctl list-timers --all` and verify all scheduled jobs are listed with correct `NEXT` execution times and `LAST` execution logs.
2. Verify that there are no failed systemd services:
   ```bash
   systemctl --failed
   ```
3. Check the newsletter_editions table to confirm daily editions are compiles:
   ```sql
   SELECT edition_date, edition_type, compiled_at FROM newsletter_editions ORDER BY compiled_at DESC LIMIT 5;
   ```
