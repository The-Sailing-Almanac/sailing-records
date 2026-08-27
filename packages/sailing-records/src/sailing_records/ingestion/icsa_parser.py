"""
icsa_parser.py

Reads raw_icsa/{season}/{slug}/sailors.html and main.html files,
parses them with BeautifulSoup, and inserts into sailing_data.db with
platform='ICSA'.

Sailor slug (from URL like /sailors/michael-kirkman/) is the canonical
persistent identifier. Schools and divisions are stored on participation
since ICSA doesn't have boats in the same sense as Yacht Scoring.
boat_id is NULL for all ICSA participation rows.
"""
import os
import re
import sqlite3
import time
import html as html_lib
from bs4 import BeautifulSoup

DB_PATH = "sailing_data.db"
RAW_DIR = "raw_icsa"

SCHEMA_ADDITIONS = [
    ("sailors", "slug", "TEXT"),
]


def ensure_schema(con):
    cur = con.cursor()
    for table, column, coltype in SCHEMA_ADDITIONS:
        try:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}")
            print(f"  Added {table}.{column}", flush=True)
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                continue
            raise
    try:
        cur.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_sailor_slug "
            "ON sailors(slug) WHERE slug IS NOT NULL"
        )
    except sqlite3.OperationalError:
        pass
    con.commit()


def parse_season_date(season):
    half = "spring" if season[0] == "s" else "fall"
    year = 2000 + int(season[1:])
    return year, half


def extract_regatta_meta(main_html, slug, season):
    soup = BeautifulSoup(main_html, "html.parser")
    meta = {
        "event_name": slug,
        "host":       None,
        "city":       None,
        "start_date": None,
    }
    name_el = soup.find(attrs={"itemprop": "name"})
    if name_el:
        meta["event_name"] = name_el.get_text(strip=True)
    loc_el = soup.find(attrs={"itemprop": "location"})
    if loc_el:
        meta["city"] = loc_el.get_text(strip=True)
    time_el = soup.find(attrs={"itemprop": "startDate"})
    if time_el and time_el.get("datetime"):
        meta["start_date"] = time_el["datetime"][:10]
    if not meta["start_date"]:
        year, half = parse_season_date(season)
        meta["start_date"] = f"{year}-{'04' if half == 'spring' else '10'}-01"
    return meta


SAILOR_LINK_RE = re.compile(
    r'<a href="/sailors/([^/]+)/?"[^>]*>([^<]+)</a>', re.IGNORECASE
)
NAME_GRAD_RE = re.compile(r"^(.*?)\s*'(\d{2})\s*$")


def normalize_name(name):
    return re.sub(r"\s+", " ", html_lib.unescape(name)).strip()


def parse_sailor_anchor(html_str):
    out = []
    for slug, raw_name in SAILOR_LINK_RE.findall(html_str):
        name = normalize_name(raw_name)
        grad = None
        m = NAME_GRAD_RE.match(name)
        if m:
            name = m.group(1).strip()
            yy   = int(m.group(2))
            grad = 2000 + yy
        out.append({"slug": slug, "name": name, "grad_year": grad})
    return out


def parse_sailors_page(sailors_html):
    if not sailors_html.strip():
        return []
    soup = BeautifulSoup(sailors_html, "html.parser")

    records  = []
    records2 = []
    current_school   = None
    current_division = None

    table  = soup.find("table", class_=re.compile(r"results"))
    tables = [table] if table else soup.find_all("table")

    # First pass: school/division context + sailor info
    for tbl in tables:
        for tr in tbl.find_all("tr"):
            school_td = tr.find("td", class_="schoolname")
            if school_td:
                a = school_td.find("a")
                current_school = (
                    a.get_text(strip=True) if a
                    else school_td.get_text(strip=True)
                )

            div_td = tr.find("td", class_="division-cell")
            if div_td:
                current_division = div_td.get_text(strip=True)

            races_cells = tr.find_all("td", class_="races")
            if not races_cells:
                continue

            for races_td in races_cells:
                race_range = races_td.get_text(strip=True)
                prev = races_td.find_previous_sibling("td")
                if not prev:
                    continue
                anchors = parse_sailor_anchor(str(prev))
                if not anchors:
                    continue
                a = anchors[0]
                records.append({
                    "school":      current_school,
                    "division":    current_division,
                    "sailor_slug": a["slug"],
                    "sailor_name": a["name"],
                    "grad_year":   a["grad_year"],
                    "race_range":  race_range,
                    "role":        None,
                })

    # Second pass: determine role by position index
    for tbl in tables:
        for tr in tbl.find_all("tr"):
            races_cells = tr.find_all("td", class_="races")
            for idx, races_td in enumerate(races_cells):
                prev = races_td.find_previous_sibling("td")
                if not prev:
                    continue
                anchors = parse_sailor_anchor(str(prev))
                if not anchors:
                    continue
                a = anchors[0]
                records2.append({
                    "sailor_slug": a["slug"],
                    "sailor_name": a["name"],
                    "grad_year":   a["grad_year"],
                    "race_range":  races_td.get_text(strip=True),
                    "role":        "skipper" if idx == 0 else "crew",
                })

    # Merge role back into records
    merged = []
    for r, r2 in zip(records, records2):
        if r["sailor_slug"] == r2["sailor_slug"]:
            r["role"] = r2["role"]
        # Safety net — never leave role as None
        if not r["role"]:
            r["role"] = "crew"
        merged.append(r)
    return merged


def upsert_sailor(cur, slug, name):
    cur.execute("SELECT id FROM sailors WHERE slug = ? LIMIT 1", (slug,))
    row = cur.fetchone()
    if row:
        return row[0]
    # Try to attach slug to existing name-only record
    cur.execute(
        "SELECT id FROM sailors WHERE name_normalized = ? AND slug IS NULL LIMIT 1",
        (name.lower(),)
    )
    row = cur.fetchone()
    if row:
        cur.execute("UPDATE sailors SET slug = ? WHERE id = ?", (slug, row[0]))
        return row[0]
    # Create new
    parts = name.split()
    first = parts[0]          if parts         else None
    last  = parts[-1]         if len(parts) > 1 else None
    cur.execute("""
        INSERT INTO sailors
            (full_name, first_name, last_name,
             match_confidence, name_normalized, slug, parsed_at)
        VALUES (?, ?, ?, 'id', ?, ?, datetime('now'))
    """, (name, first, last, name.lower(), slug))
    return cur.lastrowid


def upsert_regatta(cur, slug, season, meta):
    url = f"https://scores.collegesailing.org/{season}/{slug}/"
    cur.execute(
        "SELECT id FROM regattas WHERE raw_event_url = ? LIMIT 1", (url,)
    )
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute("""
        INSERT INTO regattas
            (event_name, start_date, city, platform,
             is_completed, raw_event_url, parsed_at)
        VALUES (?, ?, ?, 'ICSA', 1, ?, datetime('now'))
    """, (meta["event_name"], meta["start_date"], meta["city"], url))
    return cur.lastrowid


def process_event(cur, season, slug):
    event_dir    = os.path.join(RAW_DIR, season, slug)
    main_path    = os.path.join(event_dir, "main.html")
    sailors_path = os.path.join(event_dir, "sailors.html")

    if not os.path.exists(main_path) or not os.path.exists(sailors_path):
        return "skip-missing"

    with open(main_path,     encoding="utf-8") as f: main_html    = f.read()
    with open(sailors_path,  encoding="utf-8") as f: sailors_html = f.read()

    meta       = extract_regatta_meta(main_html, slug, season)
    regatta_id = upsert_regatta(cur, slug, season, meta)

    if not sailors_html.strip():
        return "main-only"

    records = parse_sailors_page(sailors_html)
    if not records:
        return "no-sailors"

    inserts = 0
    for r in records:
        if not r["sailor_slug"]:
            continue
        role = r.get("role") or "crew"
        sailor_id = upsert_sailor(cur, r["sailor_slug"], r["sailor_name"])
        try:
            cur.execute("""
                INSERT INTO participation
                    (sailor_id, boat_id, regatta_id, role,
                     school, division, graduation_year, race_range)
                VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
            """, (sailor_id, regatta_id, role,
                  r.get("school"), r.get("division"),
                  r.get("grad_year"), r.get("race_range")))
            inserts += 1
        except sqlite3.IntegrityError:
            pass
    return f"ok({inserts})"


def main():
    if not os.path.isdir(RAW_DIR):
        print(f"No {RAW_DIR}/ directory found. Run icsa_catcher.py first.")
        return

    con = sqlite3.connect(DB_PATH, timeout=30)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=NORMAL")
    cur = con.cursor()
    ensure_schema(con)

    events = []
    for season in sorted(os.listdir(RAW_DIR)):
        season_dir = os.path.join(RAW_DIR, season)
        if not os.path.isdir(season_dir):
            continue
        for slug in sorted(os.listdir(season_dir)):
            event_dir = os.path.join(season_dir, slug)
            if os.path.isdir(event_dir):
                events.append((season, slug))

    print(f"Processing {len(events):,} ICSA events ...", flush=True)
    started = time.time()
    counts  = {}

    for i, (season, slug) in enumerate(events, 1):
        try:
            status = process_event(cur, season, slug)
        except Exception as e:
            status = f"err-{type(e).__name__}"
            print(f"  {season}/{slug}: {e}", flush=True)
        bucket = "ok" if status.startswith("ok") else status
        counts[bucket] = counts.get(bucket, 0) + 1

        if i % 100 == 0:
            con.commit()
            elapsed = time.time() - started
            rate    = i / elapsed if elapsed > 0 else 0
            eta     = (len(events) - i) / rate / 60 if rate else 0
            print(
                f"  [{i:,}/{len(events):,}] "
                f"{rate:.1f}/s  ETA {eta:.0f}m  {counts}",
                flush=True
            )

    con.commit()
    con.close()
    print(f"\nDone. Final counts: {counts}", flush=True)


if __name__ == "__main__":
    main()