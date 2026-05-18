"""
catcher-in-the-py.py

Pulls raw JSON for each Yacht Scoring eID into raw/{eID}/*.json.
Idempotent: skips eIDs whose folder already has all expected files.
"""
import httpx
import sqlite3
import time
from pathlib import Path

# ---------- CONFIG ----------
DB_PATH = "sailing_urls.db"
RAW_DIR = Path("raw")
SLEEP_SECONDS = 0.3
TIMEOUT = 30
BASE = "https://api.yachtscoring.com/v1/public"

# Set to a list like [16941] for a sanity check on one regatta.
# Set to None to fetch every eID in the harvester DB.
SANITY_CHECK_EIDS = None
# ----------------------------

HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://www.yachtscoring.com",
    "Referer": "https://www.yachtscoring.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/146.0.0.0 Safari/537.36",
}

# (filename_stem, url_path_te