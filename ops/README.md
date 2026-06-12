# Ops

Data sync scripts for the sailing-records project.

## Data model

Code (this repo) lives on GitHub.
**Data lives on chantecler-01 and is the authoritative copy.**

Databases and raw scraped files are gitignored and never committed.
The server at `chantecler-01:~/sailing-records/` holds the canonical versions.

```
chantecler-01:~/sailing-records/
    sailing_data.db     ← main analytical database (~400 MB)
    sailing_urls.db     ← URL registry for harvesters
    raw/                ← YachtScoring raw JSON
    raw_icsa/           ← ICSA Techscore raw HTML
    raw_rn/             ← Regatta Network raw HTML
```

## Sync scripts

| Script | When to run | Notes |
|---|---|---|
| `python ops/sync_data.py pull` | Before starting local work | server → local |
| `python ops/sync_data.py push` | After harvesting or parsing | local → server |

Run from the project root. Works on all platforms — uses `rsync` when available,
falls back to `scp` automatically (Windows with OpenSSH).

```bash
python ops/sync_data.py pull   # get latest before working
python ops/sync_data.py push   # send results back to server
```

The `chantecler-01` SSH alias must be configured in your local `~/.ssh/config`.

## Bash scripts (rsync, Linux/Mac/WSL)

`ops/push-data.sh` and `ops/pull-data.sh` are provided for environments where
`rsync` is available natively. They are faster for large incremental syncs.
On Windows, `sync_data.py` is the standard path.

## Server git setup

The server's git remote uses the `sailing-records-deploy` SSH key:

```
origin  git@github-sailing-records:woodyardae/sailing-records.git
```

To pull code updates on the server:

```bash
ssh chantecler-01
cd ~/sailing-records
git pull
```

## Typical workflow

```bash
# 1. Pull latest data before working
bash ops/pull-data.sh

# 2. Do work (run harvesters, parsers, analysis)
python ingestion/rn_harvester.py
python ingestion/rn_parser.py

# 3. Push results back to server
bash ops/push-data.sh

# 4. Commit and push any code changes
git add ingestion/rn_harvester.py
git commit -m "..."
git push
```

## Server cron

The authoritative server should run collection from `~/sailing-records`, where
the canonical databases and raw files live. Use `ops/run_harvest_cycle.sh` so
runs are locked, logged, and repeatable.

Install example:

```bash
ssh chantecler-01
cd ~/sailing-records
git pull
chmod +x ops/run_harvest_cycle.sh
crontab -e
```

Recommended schedule:

```cron
# Nightly lightweight discovery, parsing, analysis, and almanac export.
15 2 * * * SAILING_RECORDS_DIR=$HOME/sailing-records YACHT_SCORING_MAX=65000 REGATTA_NETWORK_MAX_ID=34000 RUN_CLUBSPOT=0 $HOME/sailing-records/ops/run_harvest_cycle.sh

# Weekly Clubspot refresh. This is heavier because it pages the public API.
15 4 * * 0 SAILING_RECORDS_DIR=$HOME/sailing-records RUN_DISCOVERY=0 RUN_CLUBSPOT=1 RUN_PARSE=0 RUN_ANALYSIS=1 RUN_EXPORT=1 $HOME/sailing-records/ops/run_harvest_cycle.sh
```

Logs are written to `ops/logs/` and ignored by Git.

Current caveat: YachtScoring and Regatta Network URL discovery are scheduled
here, but their raw-result fetch step is still separate from the active parser
scripts. Before relying on the nightly job for full YachtScoring or Regatta
Network backfill, restore or promote the relevant raw fetchers from `archive/`
into `ingestion/`.
