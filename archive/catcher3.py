"""catcher3.py — production fetcher with visible per-eID progress"""
import httpx, sqlite3, time, sys
from pathlib import Path

DB_PATH = "sailing_urls.db"
RAW_DIR = Path("raw")
SLEEP_SECONDS = 0.3
TIMEOUT = 30
BASE = "https://api.yachtscoring.com/v1/public"

HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://www.yachtscoring.com",
    "Referer": "https://www.yachtscoring.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/146.0.0.0 Safari/537.36",
}

ENDPOINTS = [
    ("event",               "/event/{eid}"),
    ("boats",               "/event/{eid}/boats?size=99999"),
    ("races",               "/event/{eid}/races?size=99999"),
    ("splits",              "/event/{eid}/splits?size=99999"),
    ("cumulative",          "/event/{eid}/cumulative-result"),
    ("cumulative_subclass", "/event/{eid}/cumulative-result?requireSubclass=true"),
]


def log(msg):
    print(msg, flush=True)


def get_eids():
    con = sqlite3.connect(DB_PATH)
    rows = con.execute("""
        SELECT DISTINCT CAST(SUBSTR(url, INSTR(url, 'eID=') + 4) AS INTEGER) AS eid
        FROM registry
        WHERE platform = 'YachtScoring' AND url LIKE '%eID=%'
        ORDER BY eid
    """).fetchall()
    con.close()
    return [r[0] for r in rows if r[0] and r[0] > 0]


def folder_complete(folder):
    if (folder / "_missing.flag").exists() or (folder / "_error.flag").exists():
        return True
    return all((folder / f"{stem}.json").exists() for stem, _ in ENDPOINTS)


def fetch_eid(client, eid):
    folder = RAW_DIR / str(eid)
    if folder.exists() and folder_complete(folder):
        return "skipped"
    folder.mkdir(parents=True, exist_ok=True)

    try:
        probe = client.get(f"{BASE}/event/{eid}", timeout=TIMEOUT)
    except Exception as e:
        (folder / "_error.flag").write_text(f"probe exception: {e}")
        return "error"

    if probe.status_code == 404:
        (folder / "_missing.flag").write_text("404")
        return "missing"
    if probe.status_code != 200:
        (folder / "_error.flag").write_text(f"status {probe.status_code}")
        return "error"

    (folder / "event.json").write_text(probe.text, encoding="utf-8")
    for stem, tmpl in ENDPOINTS[1:]:
        try:
            r = client.get(BASE + tmpl.format(eid=eid), timeout=TIMEOUT)
            (folder / f"{stem}.json").write_text(r.text, encoding="utf-8")
        except Exception as e:
            (folder / f"{stem}.error").write_text(str(e))
        time.sleep(SLEEP_SECONDS)
    return "ok"


def main():
    RAW_DIR.mkdir(exist_ok=True)
    eids = get_eids()
    log(f"Processing {len(eids):,} eIDs from {DB_PATH}")

    counts = {"ok": 0, "skipped": 0, "missing": 0, "error": 0}
    started = time.time()

    with httpx.Client(headers=HEADERS) as client:
        for i, eid in enumerate(eids, 1):
            try:
                result = fetch_eid(client, eid)
            except Exception as e:
                result = "error"
                log(f"  [{eid}] EXCEPTION: {e}")
            counts[result] += 1

            if i % 25 == 0 or i == len(eids):
                elapsed = time.time() - started
                rate = i / elapsed if elapsed else 0
                remaining = (len(eids) - i) / rate if rate else 0
                log(f"[{i:>6}/{len(eids):,}] eid={eid:>5} -> {result:<8} "
                    f"ok={counts['ok']} skip={counts['skipped']} "
                    f"miss={counts['missing']} err={counts['error']}  "
                    f"{rate:.1f}/s, ~{remaining/60:.0f}m left")

    log(f"\nDone in {(time.time()-started)/60:.2f} min: {counts}")


if __name__ == "__main__":
    main()