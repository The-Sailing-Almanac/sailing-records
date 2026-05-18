"""
icsa_catcher.py

Reads ICSA regatta URLs from sailing_urls.db (platform='ICSA') and
fetches each into raw_icsa/{season}/{slug}/main.html and sailors.html.

Idempotent via folder_complete() check + _missing.flag/_error.flag markers.
"""
import os
import re
import sqlite3
import time
import urllib.request
import urllib.error

DB_PATH = "sailing_urls.db"
RAW_DIR = "raw_icsa"
SLEEP_BETWEEN = 0.3
USER_AGENT = "Mozilla/5.0 (sailing-legacy-research)"

SANITY_CHECK_LIMIT = None  # set to e.g. 20 to test before full run


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_url(url):
    """Pull (season, slug) from a URL like
       https://scores.collegesailing.org/s24/east-open-national-semi-final/"""
    m = re.match(r"https://scores\.collegesailing\.org/([sf]\d{2})/([^/]+)/?", url)
    if not m:
        return None, None
    return m.group(1), m.group(2)


def folder_complete(event_dir):
    main_ok = os.path.exists(os.path.join(event_dir, "main.html"))
    sailors_ok = os.path.exists(os.path.join(event_dir, "sailors.html"))
    miss_flag = os.path.exists(os.path.join(event_dir, "_missing.flag"))
    err_flag = os.path.exists(os.path.join(event_dir, "_error.flag"))
    return (main_ok and sailors_ok) or miss_flag or err_flag


def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def write_flag(event_dir, name):
    os.makedirs(event_dir, exist_ok=True)
    with open(os.path.join(event_dir, name), "w") as f:
        f.write("")


def process_url(url):
    season, slug = parse_url(url)
    if not season or not slug:
        return "bad-url"

    event_dir = os.path.join(RAW_DIR, season, slug)
    if folder_complete(event_dir):
        return "skip"

    main_url = url if url.endswith("/") else url + "/"
    sailors_url = main_url + "sailors/"

    try:
        main_html = fetch(main_url)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            write_flag(event_dir, "_missing.flag")
            return "404"
        write_flag(event_dir, "_error.flag")
        return f"err-main-{e.code}"
    except Exception as e:
        write_flag(event_dir, "_error.flag")
        return f"err-main-{type(e).__name__}"

    write_file(os.path.join(event_dir, "main.html"), main_html)
    time.sleep(SLEEP_BETWEEN)

    try:
        sailors_html = fetch(sailors_url)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            write_file(os.path.join(event_dir, "sailors.html"), "")
            return "main-only"
        write_flag(event_dir, "_error.flag")
        return f"err-sailors-{e.code}"
    except Exception as e:
        write_flag(event_dir, "_error.flag")
        return f"err-sailors-{type(e).__name__}"

    write_file(os.path.join(event_dir, "sailors.html"), sailors_html)
    return "ok"


def main():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute(
        "SELECT url FROM registry WHERE platform = 'ICSA' ORDER BY url"
    )
    urls = [row[0] for row in cur.fetchall()]
    con.close()

    if SANITY_CHECK_LIMIT:
        urls = urls[:SANITY_CHECK_LIMIT]
    print(f"Processing {len(urls):,} ICSA URLs ...", flush=True)

    started = time.time()
    counts = {}
    for i, url in enumerate(urls, 1):
        status = process_url(url)
        counts[status] = counts.get(status, 0) + 1
        if i % 50 == 0 or i == len(urls):
            elapsed = time.time() - started
            rate = i / elapsed if elapsed > 0 else 0
            eta_min = (len(urls) - i) / rate / 60 if rate > 0 else 0
            print(f"  [{i:,}/{len(urls):,}] "
                  f"{rate:.1f}/s  ETA {eta_min:.0f}m  "
                  f"{counts}", flush=True)
        if status != "skip":
            time.sleep(SLEEP_BETWEEN)

    print(f"\nDone. Final counts: {counts}", flush=True)


if __name__ == "__main__":
    main()