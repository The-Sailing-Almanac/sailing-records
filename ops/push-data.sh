#!/usr/bin/env bash
# push-data.sh
# Push local data to the authoritative copy on chantecler-01.
# Run this after harvesting or parsing locally to sync results back.
#
# Usage: bash ops/push-data.sh
# Run from project root.

set -euo pipefail

REMOTE="chantecler-01:~/sailing-records"

echo "Pushing data to $REMOTE..."

rsync -avz --progress sailing_data.db      "$REMOTE/"
rsync -avz --progress sailing_urls.db      "$REMOTE/"
rsync -avz --progress raw/                 "$REMOTE/raw/"
rsync -avz --progress raw_icsa/            "$REMOTE/raw_icsa/"
rsync -avz --progress raw_rn/             "$REMOTE/raw_rn/"

echo "Done. Server is up to date."
