#!/usr/bin/env python3
"""
merge_sailwave_urls.py

Merge local Sailwave URL registry rows into an authoritative sailing_urls.db copy.

Usage:
    python ops/merge_sailwave_urls.py local_urls.db authoritative-urls-copy.db
"""
import sqlite3
import sys


def ensure_registry(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS registry (
            url         TEXT PRIMARY KEY,
            platform    TEXT NOT NULL,
            event_name  TEXT,
            status      TEXT
        )
    """)


def merge(local_path, dst_path):
    src = sqlite3.connect(local_path)
    dst = sqlite3.connect(dst_path)
    src_cur = src.cursor()
    dst_cur = dst.cursor()
    ensure_registry(dst_cur)

    src_cur.execute(
        "SELECT url, platform, event_name, status FROM registry WHERE platform='Sailwave'"
    )
    rows = src_cur.fetchall()
    for row in rows:
        dst_cur.execute("""
            INSERT INTO registry (url, platform, event_name, status)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(url) DO UPDATE SET
                platform=excluded.platform,
                event_name=excluded.event_name,
                status=excluded.status
        """, row)
    dst.commit()
    src.close()
    dst.close()
    return len(rows)


def main():
    if len(sys.argv) != 3:
        print(__doc__.strip())
        return 2
    print(f"registry_rows: {merge(sys.argv[1], sys.argv[2])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
