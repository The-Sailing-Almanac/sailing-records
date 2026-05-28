"""
sailwave_harvester.py

Fetches seeded Sailwave result pages and stores the original bytes under
raw_intl/sailwave/{event_id}/. This harvester intentionally does no parsing or
translation; parser outputs must remain traceable to the saved source files.
"""
import csv
import hashlib
import json
import re
import sqlite3
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

DB_PATH = "sailing_urls.db"
SEED_DIR = Path("data/source_seeds")
RAW_DIR = Path("raw_intl/sailwave")
USER_AGENT = "Mozilla/5.0 (sailing-records-research; +public-results)"


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def event_id_for_url(url):
    parsed = urlparse(url)
    stem = Path(parsed.path).name or parsed.netloc
    stem = re.sub(r"\.[a-zA-Z0-9]+$", "", stem)
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", stem).strip("-").lower()
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:10]
    return f"{slug or 'sailwave'}-{digest}"


def ensure_registry(con):
    con.execute("""
        CREATE TABLE IF NOT EXISTS registry (
            url         TEXT PRIMARY KEY,
            platform    TEXT NOT NULL,
            event_name  TEXT,
            status      TEXT
        )
    """)
    con.commit()


def seed_files():
    if not SEED_DIR.exists():
        return []
    return sorted(SEED_DIR.glob("*.csv"))


def read_seeds():
    seen = set()
    for path in seed_files():
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                if row.get("platform", "").strip().lower() != "sailwave":
                    continue
                url = row.get("url", "").strip()
                if not url or url in seen:
                    continue
                seen.add(url)
                row["seed_file"] = str(path)
                yield row


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=45) as resp:
        body = resp.read()
        headers = dict(resp.headers.items())
        return resp.geturl(), resp.status, headers, body


def classify(url, headers, body):
    content_type = headers.get("Content-Type", "")
    if not body:
        return "empty"
    if "pdf" in content_type.lower() or urlparse(url).path.lower().endswith(".pdf"):
        return "pdf"
    if url.rstrip("/").endswith("/results") or url.rstrip("/").endswith("/results/"):
        return "index"
    if b"<table" in body.lower() and b"sailwave" in body.lower():
        return "ok"
    if b"sailwave" in body.lower():
        return "candidate"
    if "html" in content_type.lower():
        return "candidate"
    return "unsupported"


def source_filename(final_url, headers):
    content_type = headers.get("Content-Type", "").lower()
    path = urlparse(final_url).path.lower()
    if "pdf" in content_type or path.endswith(".pdf"):
        return "source.pdf"
    if "json" in content_type or path.endswith(".json"):
        return "source.json"
    return "source.html"


def write_artifacts(seed, final_url, status_code, headers, body):
    event_id = event_id_for_url(seed["url"])
    folder = RAW_DIR / event_id
    folder.mkdir(parents=True, exist_ok=True)
    source_name = source_filename(final_url, headers)
    source_path = folder / source_name
    metadata_path = folder / "metadata.json"

    source_path.write_bytes(body)
    metadata = {
        "platform": "Sailwave",
        "seed_url": seed["url"],
        "final_url": final_url,
        "country": seed.get("country") or None,
        "language_hint": seed.get("language_hint") or None,
        "notes": seed.get("notes") or None,
        "status_code": status_code,
        "content_type": headers.get("Content-Type"),
        "content_length": len(body),
        "source_filename": source_name,
        "sha256": hashlib.sha256(body).hexdigest(),
        "fetched_at": now_iso(),
    }
    metadata_path.write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return event_id


def main():
    con = sqlite3.connect(DB_PATH, timeout=30)
    ensure_registry(con)
    cur = con.cursor()

    counts = {}
    for seed in read_seeds():
        url = seed["url"]
        try:
            final_url, status_code, headers, body = fetch(url)
            status = classify(final_url, headers, body)
            event_id = write_artifacts(seed, final_url, status_code, headers, body)
            cur.execute(
                "INSERT OR REPLACE INTO registry (url, platform, event_name, status) "
                "VALUES (?, 'Sailwave', ?, ?)",
                (url, event_id, status),
            )
            print(f"{status:>11}  {event_id}  {url}", flush=True)
        except urllib.error.HTTPError as e:
            status = f"err-{e.code}"
            cur.execute(
                "INSERT OR REPLACE INTO registry (url, platform, event_name, status) "
                "VALUES (?, 'Sailwave', NULL, ?)",
                (url, status),
            )
            print(f"{status:>11}  {url}", flush=True)
        except Exception as e:
            status = f"err-{type(e).__name__}"
            cur.execute(
                "INSERT OR REPLACE INTO registry (url, platform, event_name, status) "
                "VALUES (?, 'Sailwave', NULL, ?)",
                (url, status),
            )
            print(f"{status:>11}  {url}: {e}", flush=True)
        counts[status] = counts.get(status, 0) + 1
        con.commit()

    con.close()
    print(f"\nDone. Final counts: {counts}", flush=True)


if __name__ == "__main__":
    main()
