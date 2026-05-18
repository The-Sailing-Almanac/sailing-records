"""
icsa_harvester.py

Walks all ICSA Techscore season indexes (s24, f23, s23, ..., f08) and
extracts every regatta URL. Writes results into sailing_urls.db with
platform='ICSA'.

The season list is built dynamically by scraping the homepage sidebar,
so this stays current without code changes when new seasons appear.
"""
import re
import sqlite3
import time
import urllib.request

BASE = "https://scores.collegesailing.org"
DB_PATH = "sailing_urls.db"
SLEEP_BETWEEN = 0.3
USER_AGENT = "Mozilla/5.0 (sailing-legacy-research)"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def list_seasons():
    """Scrape the 'Other seasons' sidebar from the homepage."""
    html = fetch(f"{BASE}/")
    matches = re.findall(r'href="/([sf]\d{2})/"', html)
    seen, out = set(), []
    for m in matches:
        if m not in seen:
            seen.add(m)
            out.append(m)
    return out


def parse_season_index(season):
    """Return list of (event_name, event_slug) tuples for a season."""
    url = f"{BASE}/{season}/"
    html = fetch(url)
    out = []
    pattern = re.compile(
        r'<a href="([^"/]+)">([^<]+)</a>', re.IGNORECASE
    )
    for href, name in pattern.findall(html):
        if href.startswith("#") or href.startswith("http"):
            continue
        if name.strip().lower() in {"top", "home", "schools", "seasons"}:
            continue
        out.append((name.strip(), href))
    seen = set()
    deduped = []
    for name, slug in out:
        if slug in seen:
            continue
        seen.add(slug)
        deduped.append((name, slug))
    return deduped


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
    print(f"Fetching season list from {BASE}/ ...", flush=True)
    seasons = list_seasons()
    print(f"  Found {len(seasons)} seasons: "
          f"{seasons[0]} ... {seasons[-1]}", flush=True)

    con = sqlite3.connect(DB_PATH, timeout=30)
    con.execute("PRAGMA journal_mode=WAL")
    ensure_schema(con)
    cur = con.cursor()

    total_added = 0
    for i, season in enumerate(seasons, 1):
        try:
            events = parse_season_index(season)
        except Exception as e:
            print(f"  [{i}/{len(seasons)}] {season}: ERROR {e}", flush=True)
            time.sleep(SLEEP_BETWEEN)
            continue

        added_this_season = 0
        for event_name, slug in events:
            url = f"{BASE}/{season}/{slug}/"
            try:
                cur.execute(
                    "INSERT OR IGNORE INTO registry (url, platform, event_name, status) "
                    "VALUES (?, 'ICSA', ?, 'pending')",
                    (url, event_name)
                )
                if cur.rowcount > 0:
                    added_this_season += 1
            except sqlite3.IntegrityError:
                pass
        con.commit()
        total_added += added_this_season
        print(f"  [{i}/{len(seasons)}] {season}: "
              f"{len(events)} events ({added_this_season} new)", flush=True)
        time.sleep(SLEEP_BETWEEN)

    print(f"\nDone. Added {total_added:,} new ICSA URLs to registry.", flush=True)
    con.close()


if __name__ == "__main__":
    main()