# DO NOT DO

These are hard stops, not suggestions.

## Never commit secrets
Do not commit API keys, passwords, tokens, private URLs, `.env` contents, certificates, or copied credential material.

## Never clutter the repo root
Do not leave scratch notes, raw imports, debug files, ad hoc scripts, one-off databases, or transient logs in the root. Put durable data under `/data/`, operational assets under `/ops/`, and run artifacts under `/runs/`.

## Never perform mass deletions casually
If a change deletes more than 10 files, stop. Open an issue first. Explain what is being removed, why it is safe, and what replaces it.

## Never edit protected paths without review
Protected paths should be declared per repo, but defaults include:
- `.github/workflows/`
- deployment scripts
- auth and secrets code
- database schema and migration folders
- production infrastructure definitions

Stop. Open an issue first.

## Never change dependencies without review
Do not change `package.json`, `requirements.txt`, lockfiles, container base images, or runtime versions as a drive-by edit. Explain the reason, expected impact, and rollback plan first.

## Never bypass lifecycle rules
Do not mark a repo paused, deprecated, or archived without explicit owner intent and documented signage. This repo is a Staged-Shell: do not activate it (change lifecycle_state to Active) without explicit owner intent.

## Never guess about security or data integrity
If you do not understand the impact on security, user data, external integrations, or archival history, stop. Open an issue first.

## Never reference Elevated-tier repos in external context
If this repo is Security Tier: Elevated, or if you are working in any repo and need to reference an Elevated-tier repo: do not include its name, purpose, contents, or file paths in Notion syncs, run logs, handoff files, dashboard data, or any output that leaves this local context. Treat its existence as need-to-know.
