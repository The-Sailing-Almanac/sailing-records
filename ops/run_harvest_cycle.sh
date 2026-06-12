#!/usr/bin/env bash
#
# Cron-safe harvest/import runner for the authoritative server.
#
# Intended host:
#   chantecler-01:~/sailing-records
#
# Defaults are conservative for nightly runs. Clubspot is useful but expensive
# because it re-pages the public API; run it weekly unless actively backfilling.

set -uo pipefail

REPO_DIR="${SAILING_RECORDS_DIR:-$HOME/sailing-records}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
LOG_DIR="${LOG_DIR:-$REPO_DIR/ops/logs}"
LOCK_FILE="${LOCK_FILE:-/tmp/sailing-records-harvest.lock}"

RUN_DISCOVERY="${RUN_DISCOVERY:-1}"
RUN_CLUBSPOT="${RUN_CLUBSPOT:-0}"
RUN_PARSE="${RUN_PARSE:-1}"
RUN_ANALYSIS="${RUN_ANALYSIS:-1}"
RUN_EXPORT="${RUN_EXPORT:-1}"

YACHT_SCORING_MAX="${YACHT_SCORING_MAX:-65000}"
REGATTA_NETWORK_MAX_ID="${REGATTA_NETWORK_MAX_ID:-34000}"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/harvest-$(date -u +%Y%m%dT%H%M%SZ).log"

exec > >(tee -a "$LOG_FILE") 2>&1
exec 9>"$LOCK_FILE"

if ! flock -n 9; then
  echo "[$(date -Is)] Another harvest cycle is already running; exiting."
  exit 0
fi

cd "$REPO_DIR" || {
  echo "[$(date -Is)] ERROR: repo directory not found: $REPO_DIR"
  exit 1
}

failures=0

run_step() {
  local name="$1"
  shift
  echo
  echo "[$(date -Is)] START $name"
  "$@"
  local status=$?
  if [ "$status" -ne 0 ]; then
    failures=$((failures + 1))
    echo "[$(date -Is)] FAIL  $name status=$status"
  else
    echo "[$(date -Is)] OK    $name"
  fi
}

echo "[$(date -Is)] sailing-records harvest cycle starting"
echo "repo=$REPO_DIR"
echo "log=$LOG_FILE"
echo "RUN_DISCOVERY=$RUN_DISCOVERY RUN_CLUBSPOT=$RUN_CLUBSPOT RUN_PARSE=$RUN_PARSE RUN_ANALYSIS=$RUN_ANALYSIS RUN_EXPORT=$RUN_EXPORT"
echo "YACHT_SCORING_MAX=$YACHT_SCORING_MAX REGATTA_NETWORK_MAX_ID=$REGATTA_NETWORK_MAX_ID"

run_step "git pull" git pull --ff-only

if [ "$RUN_DISCOVERY" = "1" ]; then
  run_step "YachtScoring/ICSA URL discovery" env YACHT_SCORING_MAX="$YACHT_SCORING_MAX" "$PYTHON_BIN" ingestion/sailing_urls.py
  run_step "ICSA URL discovery" "$PYTHON_BIN" ingestion/icsa_harvester.py
  run_step "Regatta Network URL discovery" env REGATTA_NETWORK_MAX_ID="$REGATTA_NETWORK_MAX_ID" "$PYTHON_BIN" ingestion/rn_harvester.py
  run_step "Sailwave seed harvest" "$PYTHON_BIN" ingestion/sailwave_harvester.py
fi

if [ "$RUN_CLUBSPOT" = "1" ]; then
  run_step "Clubspot harvest/import" "$PYTHON_BIN" ingestion/cs_harvester.py
fi

if [ "$RUN_PARSE" = "1" ]; then
  run_step "YachtScoring parse" "$PYTHON_BIN" ingestion/parser.py
  run_step "ICSA parse" "$PYTHON_BIN" ingestion/icsa_parser.py
  run_step "Regatta Network parse" "$PYTHON_BIN" ingestion/rn_parser.py
  run_step "Sailwave parse" "$PYTHON_BIN" ingestion/sailwave_parser.py
fi

if [ "$RUN_ANALYSIS" = "1" ]; then
  run_step "family detection" "$PYTHON_BIN" analysis/detect_families.py
  run_step "Sailwave alias linking" "$PYTHON_BIN" analysis/link_sailwave_aliases.py
fi

if [ "$RUN_EXPORT" = "1" ]; then
  run_step "almanac export" "$PYTHON_BIN" analysis/export_almanac.py
fi

echo
echo "[$(date -Is)] harvest cycle finished failures=$failures"
exit "$failures"
