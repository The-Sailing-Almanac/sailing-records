#!/usr/bin/env bash
# pull-data.sh
# Pull the authoritative data from chantecler-01 to your local working copy.
# Run this before starting local work to make sure you have the latest data.
#
# Usage: bash ops/pull-data.sh
# Run from project root.

set -euo pipefail

REMOTE="chantecler-01:~/sailing-records"

echo "Pulling data from $REMOTE..."

rsync -avz --progress "$REMOTE/sailing_data.db"  .
rsync -avz --progress "$REMOTE/sailing_urls.db"  .
rsync -avz --progress "$REMOTE/raw/"             raw/
rsync -avz --progress "$REMOTE/raw_icsa/"        raw_icsa/
rsync -avz --progress "$REMOTE/raw_rn/"          raw_rn/

echo "Done. Local copy is up to date."
