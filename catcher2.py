print("LINE 1: script started")

import httpx
print("LINE 2: httpx imported")

import sqlite3
print("LINE 3: sqlite3 imported")

import time
print("LINE 4: time imported")

from pathlib import Path
print("LINE 5: pathlib imported")

DB_PATH = "sailing_urls.db"
RAW_DIR = Path("raw")
SLEEP_SECONDS = 0.3
TIMEOUT = 30
BASE = "https://api.yachtscoring.com/v1/public"
print("LINE 6: config set")

HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://www.yachtscoring.com",
    "Referer": "https://www.yachtscoring.com/",
    "User-Agent": "Mozilla/5.0",
}
print("LINE 7: headers set")

ENDPOINTS = [
    ("event",               "/event/{eid}"),
    ("boats",               "/event/{eid}/boats?size=99999"),
    ("races",               "/event/{eid}/races?size=99999"),
    ("splits",              "/event/{eid}/splits?size=99999"),
    ("cumulative",          "/event/{eid}/cumulative-result"),
    ("cumulative_subclass", "/event/{eid}/cumulative-result?requireSubclass=true"),
]
print("LINE 8: endpoints set")

print("LINE 9: connecting to DB...")
con = sqlite3.connect(DB_PATH)
print("LINE 10: connected")

rows = con.execute("""
    SELECT DISTINCT
        CAST(SUBSTR(url, INSTR(url, 'eID=') + 4) AS INTEGER) AS eid
    FROM registry
    WHERE platform = 'YachtScoring'
      AND url LIKE '%eID=%'
    ORDER BY eid
""").fetchall()
con.close()
eids = [r[0] for r in rows if r[0] and r[0] > 0]
print(f"LINE 11: got {len(eids):,} eIDs")

print("LINE 12: creating httpx client...")
client = httpx.Client(headers=HEADERS, timeout=TIMEOUT)
print("LINE 13: client created")

RAW_DIR.mkdir(exist_ok=True)
print("LINE 14: raw dir ready")

print("LINE 15: starting fetch loop")
fetched = 0
for i, eid in enumerate(eids[:5], 1):  # just first 5 for this test
    folder = RAW_DIR / str(eid)
    folder.mkdir(parents=True, exist_ok=True)
    url = f"{BASE}/event/{eid}"
    r = client.get(url)
    print(f"  [{i}] eid={eid} -> {r.status_code}, {len(r.content)} bytes")
    if r.status_code == 200:
        (folder / "event.json").write_text(r.text, encoding="utf-8")
        fetched += 1
    time.sleep(SLEEP_SECONDS)

client.close()
print(f"LINE 16: done, fetched {fetched} of 5")