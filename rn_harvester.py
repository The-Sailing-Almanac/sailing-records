"""
rn_harvester.py

Iterates Regatta Network event IDs sequentially (1 to MAX_ID). For each
ID, fetches the results applet and decides if there's a real regatta
there. Writes confirmed URLs into sailing_urls.db with
platform='RegattaNetwork'.

Resumes from highest already-scanned ID. Idempotent.
"""
import re
import sqlite3
import time
import urllib.request
import urllib.error

DB_PATH = "sailing_urls.db"
BASE = "https://www.regattanetwork.com/clubmgmt/applet_regatta_results.php?regatta_id="
USER_AGENT = "Mozilla/5.0 (sailing-legacy-research)"
SLEEP_BETWEEN = 0.3

MIN_ID = 1
MAX_ID = 32000


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("iso-8859-1", errors="replace")


TITLE_RE = re.compile(
    r"<title>\s*([^<]+?)\s*-\s*Series Standing\s*</title>", re.IGNORECASE
)


def classify(html):
    """Return (event_name_or_None, status). status in {'ok','empty','missing'}."""
    if not html or len(html) < 500:
        return None, "missing"
    m = TITLE_RE.search(html)
    if not m:
        return None, "missing"
    name = m.group(1).strip()
    if "data-skipper=" in html:
        return name, "ok"
    return name, "empty"


def ensure_schema(con):
    cur = con.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS registry (
            url         TEXT PRIMARY KEY,
            platform    TEXT NOT NULL,
            event_name  TEXT,
            status      TEXT
        )
    """)
    con.commit()


def main():
    con = sqlite3.connect(DB_PATH, timeout=30)
    con.execute("PRAGMA journal_mode=WAL")
    ensure_schema(con)
    cur = con.cursor()

    # Find resume point
    cur.execute("SELECT url FROM registry WHERE platform='RegattaNetwork'")
    existing_ids = set()
    for (url,) in cur.fetchall():
        m = re.search(r"regatta_id=(\d+)", url)
        if m:
            existing_ids.add(int(m.group(1)))

    if existing_ids:
        start_id = max(existing_ids) + 1
        print(f"Resuming from regatta_id={start_id} "
              f"({len(existing_ids):,} already scanned)", flush=True)
    else:
        start_id = MIN_ID

    started = time.time()
    counts = {}
    consecutive_missing = 0

    for rid in range(start_id, MAX_ID + 1):
        url = f"{BASE}{rid}"
        try:
            html = fetch(url)
            name, status = classify(html)
        except urllib.error.HTTPError as e:
            name = None
            status = "missing" if e.code == 404 else f"err-{e.code}"
        except Exception as e:
            name = None
            status = f"err-{type(e).__name__}"

        if status in ("ok", "empty"):
            cur.execute(
                "INSERT OR IGNORE INTO registry (url, platform, event_name, status) "
                "VALUES (?, 'RegattaNetwork', ?, ?)",
                (url, name, status)
            )
            consecutive_missing = 0
        elif status == "missing":
            consecutive_missing += 1

        counts[status] = counts.get(status, 0) + 1

        if rid % 100 == 0:
            con.commit()
            elapsed = time.time() - started
            done = rid - start_id + 1
            rate = done / elapsed if elapsed > 0 else 0
            print(f"  [id={rid:,}] {done:,} checked, "
                  f"{rate:.1f}/s, {counts}", flush=True)

        # Stop early if 200 consecutive misses past id 31000
        if rid > 31000 and consecutive_missing > 200:
            print(f"\n  Hit {consecutive_missing} consecutive missing at "
                  f"id={rid}. Past live range. Stopping.", flush=True)
            break

        time.sleep(SLEEP_BETWEEN)

    con.commit()
    con.close()
    print(f"\nDone. Final counts: {counts}", flush=True)


if __name__ == "__main__":
    main()