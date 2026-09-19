#!/usr/bin/env python3
"""
import-evernote-extracted.py
Bulk-imports Evernote-extracted sailing links and feed URLs into the Almanac DB.

Reads:
  scripts/extracted_sailing_links.txt  (tab-sep: url\ttitle\tpublisher or just url per line)
  scripts/extracted_sailing_feeds.txt  (one feed URL per line)

Tables written:
  article_links   (canonical_url, url_hash, title, publisher_name, moderation_state)
  feed_endpoints  (url, is_active, created_at)

Run on chantecler-01:
  cd ~/ss-sailsouthern-com
  NODE_PATH=./apps/api/node_modules python3 scripts/import-evernote-extracted.py
  -- or with explicit DB URL --
  DATABASE_URL=postgresql://... python3 scripts/import-evernote-extracted.py
"""

import os
import sys
import time
import hashlib
import logging
from pathlib import Path
from urllib.parse import urlparse

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("psycopg2 not found. Installing...")
    os.system("pip3 install psycopg2-binary --quiet")
    import psycopg2
    import psycopg2.extras

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("scripts/import-evernote.log", mode="w"),
    ],
)
log = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("Error: DATABASE_URL environment variable must be set", file=sys.stderr)
    sys.exit(1)

SCRIPTS_DIR = Path(__file__).parent
LINKS_FILE = SCRIPTS_DIR / "extracted_sailing_links.txt"
FEEDS_FILE = SCRIPTS_DIR / "extracted_sailing_feeds.txt"

BATCH_SIZE = 500


def get_conn():
    return psycopg2.connect(DATABASE_URL)


def is_valid_url(url: str) -> bool:
    try:
        url = url.strip()
        r = urlparse(url)
        if r.scheme not in ("http", "https"):
            return False
        if not r.netloc or len(r.netloc) < 3:
            return False
        # Reject URLs with encoded spaces or obviously-bad netlocs
        if "%20" in r.netloc or " " in r.netloc or r.netloc.startswith("("):
            return False
        if len(url) > 2048:
            return False
        # Must have at least a dot in the hostname
        hostname = r.hostname or ""
        if "." not in hostname:
            return False
        return True
    except Exception:
        return False


def url_hash(url: str) -> str:
    """MD5 hash of normalized URL for deduplication."""
    normalized = url.strip().lower().rstrip("/")
    return hashlib.md5(normalized.encode("utf-8")).hexdigest()


def import_feeds(conn):
    log.info("=== Importing feed endpoints ===")
    if not FEEDS_FILE.exists():
        log.warning(f"Feeds file not found: {FEEDS_FILE}")
        return 0

    inserted = 0
    skipped = 0
    batch = []

    with open(FEEDS_FILE, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            url = line.strip()
            if not url or not is_valid_url(url):
                skipped += 1
                continue
            batch.append((url,))

            if len(batch) >= BATCH_SIZE:
                inserted += _flush_feeds(conn, batch)
                batch = []

    if batch:
        inserted += _flush_feeds(conn, batch)

    log.info(f"Feeds — inserted: {inserted:,}, skipped invalid: {skipped:,}")
    return inserted


def _flush_feeds(conn, batch):
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO feed_endpoints (url, is_active, created_at)
            VALUES %s
            ON CONFLICT (url) DO NOTHING
            """,
            [(url,) for (url,) in batch],
            template="(%s, true, NOW())",
            page_size=BATCH_SIZE,
        )
    conn.commit()
    return len(batch)


def import_links(conn):
    log.info("=== Importing article links ===")
    if not LINKS_FILE.exists():
        log.warning(f"Links file not found: {LINKS_FILE}")
        return 0

    inserted = 0
    skipped = 0
    batch = []
    total_lines = 0
    last_log = 0

    with open(LINKS_FILE, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            total_lines += 1
            parts = line.rstrip("\n").split("\t")
            raw_url = parts[0].strip() if parts else ""
            title = parts[1].strip() if len(parts) > 1 else ""
            publisher = parts[2].strip() if len(parts) > 2 else ""

            if not raw_url or not is_valid_url(raw_url):
                skipped += 1
                continue

            # Normalize
            canonical = raw_url.strip()
            h = url_hash(canonical)
            # title must not be null — use domain as fallback
            if not title:
                from urllib.parse import urlparse as _up
                try:
                    title = _up(canonical).hostname or canonical[:200]
                except Exception:
                    title = canonical[:200]
            title = title[:2000]
            publisher = publisher[:500] if publisher else None

            batch.append((h, canonical, title, publisher))

            if len(batch) >= BATCH_SIZE:
                inserted += _flush_links(conn, batch)
                batch = []
                if inserted - last_log >= 50000:
                    log.info(f"  Progress: {inserted:,} links inserted so far (line {total_lines:,})...")
                    last_log = inserted

    if batch:
        inserted += _flush_links(conn, batch)

    log.info(f"Links — total lines: {total_lines:,}, inserted: {inserted:,}, skipped invalid: {skipped:,}")
    return inserted


def _flush_links(conn, batch):
    # Deduplicate within the batch by url_hash (last-writer-wins)
    seen = {}
    for row in batch:
        seen[row[0]] = row  # key = url_hash
    deduped = list(seen.values())

    with conn.cursor() as cur:
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO article_links
              (url_hash, canonical_url, title, publisher_name,
               moderation_state, discovered_at, created_at, intake_source, processing_lane)
            VALUES %s
            ON CONFLICT (url_hash) DO UPDATE
              SET title          = COALESCE(EXCLUDED.title, article_links.title),
                  publisher_name = COALESCE(EXCLUDED.publisher_name, article_links.publisher_name)
            """,
            deduped,
            template="(%s, %s, %s, %s, 'received', NOW(), NOW(), 'evernote', 'historical')",
            page_size=BATCH_SIZE,
        )
    conn.commit()
    return len(deduped)


def print_summary(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM article_links")
        total_links = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM feed_endpoints")
        total_feeds = cur.fetchone()[0]

    log.info("=== Final DB Summary ===")
    log.info(f"  article_links  total: {total_links:,}")
    log.info(f"  feed_endpoints total: {total_feeds:,}")


def main():
    log.info("Starting Evernote bulk import")
    log.info(f"  Links file : {LINKS_FILE}  exists={LINKS_FILE.exists()}")
    log.info(f"  Feeds file : {FEEDS_FILE}  exists={FEEDS_FILE.exists()}")
    log.info(f"  DB         : {DATABASE_URL.split('@')[-1]}")

    t0 = time.time()
    conn = get_conn()

    try:
        import_feeds(conn)
        import_links(conn)
        print_summary(conn)
    finally:
        conn.close()

    elapsed = time.time() - t0
    log.info(f"Done in {elapsed:.1f}s ({elapsed/60:.1f} min)")


if __name__ == "__main__":
    main()
