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
UV_BIN="${UV_BIN:-uv}"
PYTHON_BIN="${PYTHON_BIN:-python}"
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
  run_step "YachtScoring/ICSA URL discovery" env YACHT_SCORING_MAX="$YACHT_SCORING_MAX" "$UV_BIN" run --locked "$PYTHON_BIN" -m sailing_records.ingestion.sailing_urls
  run_step "ICSA URL discovery" "$UV_BIN" run --locked "$PYTHON_BIN" -m sailing_records.ingestion.icsa_harvester
  run_step "Regatta Network URL discovery" env REGATTA_NETWORK_MAX_ID="$REGATTA_NETWORK_MAX_ID" "$UV_BIN" run --locked "$PYTHON_BIN" -m sailing_records.ingestion.rn_harvester
  run_step "Sailwave seed harvest" "$UV_BIN" run --locked "$PYTHON_BIN" -m sailing_records.ingestion.sailwave_harvester
fi

if [ "$RUN_CLUBSPOT" = "1" ]; then
  run_step "Clubspot harvest/import" "$UV_BIN" run --locked "$PYTHON_BIN" -m sailing_records.ingestion.cs_harvester
fi

if [ "$RUN_PARSE" = "1" ]; then
  run_step "YachtScoring parse" "$UV_BIN" run --locked "$PYTHON_BIN" -m sailing_records.ingestion.parser
  run_step "ICSA parse" "$UV_BIN" run --locked "$PYTHON_BIN" -m sailing_records.ingestion.icsa_parser
  run_step "Regatta Network parse" "$UV_BIN" run --locked "$PYTHON_BIN" -m sailing_records.ingestion.rn_parser
  run_step "Sailwave parse" "$UV_BIN" run --locked "$PYTHON_BIN" -m sailing_records.ingestion.sailwave_parser
fi

if [ "$RUN_ANALYSIS" = "1" ]; then
  run_step "family detection" "$UV_BIN" run --locked "$PYTHON_BIN" -m sailing_records.analysis.detect_families
  run_step "Sailwave alias linking" "$UV_BIN" run --locked "$PYTHON_BIN" -m sailing_records.analysis.link_sailwave_aliases
fi

if [ "$RUN_EXPORT" = "1" ]; then
  run_step "almanac export" "$UV_BIN" run --locked "$PYTHON_BIN" -m sailing_records.analysis.export_almanac
fi

echo
echo "[$(date -Is)] harvest cycle finished failures=$failures"
exit "$failures"
