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
