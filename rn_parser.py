"""
rn_parser.py

Parses raw HTML files from raw_rn/{id}/results.html into sailing_data.db.

Each file is a Regatta Network results page with one or more fleet tables.
Column layout varies — detected dynamically from thead.

Extracts: regatta metadata, boat name, sail number, skipper, yacht club.
"""
import re
import sqlite3
import time
from pathlib import Path

RAW_DIR = Path("raw_rn")
DB_PATH = "sailing_data.db"

SCHEMA_ADDITIONS = [
    ("regattas", "rn_regatta_id", "TEXT"),
    ("boats",    "rn_sail_number","TEXT"),
]

# Regex helpers
RE_TAGS    = re.compile(r"<[^>]+>")
RE_SPACE   = re.compile(r"\s+")
RE_NBSP    = re.compile(r"&nbsp;")
RE_AMP     = re.compile(r"&amp;")
RE_TRAIL   = re.compile(r"\s*\[A\]\s*$", re.IGNORECASE)

COMPOUND_SPLITTERS = re.compile(r"\s*(?:/|&|\sand\s|\swith\s)\s*", re.IGNORECASE)


def clean(s):
    """Strip HTML tags, entities, whitespace."""
    s = RE_NBSP.sub(" ", s)
    s = RE_AMP.sub("&", s)
    s = RE_TAGS.sub("", s)
    s = RE_SPACE.sub(" ", s)
    return s.strip()


def strip_a_suffix(s):
    """Remove trailing [A] marker from skipper names."""
    return RE_TRAIL.sub("", s).strip()


def normalize_name(s):
    s = s.lower().strip()
    s = re.sub(r"[^\w\s]", "", s)
    s = RE_SPACE.sub(" ", s)
    return s.strip()


def normalize_club(s):
    if not s:
        return ""
    s = s.lower().strip()
    s = re.sub(r"[^\w\s]", " ", s)
    s = RE_SPACE.sub(" ", s).strip()
    for token in ["yacht club", "sailing club", "boat club", "yc", "sc", "club", "yacht"]:
        if s.endswith(" " + token):
            s = s[:-(len(token)+1)].strip()
    return s.strip()


def split_name(full):
    parts = (full or "").strip().split()
    suffix_set = {"jr", "jr.", "sr", "sr.", "ii", "iii", "iv"}
    while len(parts) > 1 and parts[-1].lower().strip(".") in suffix_set:
        parts = parts[:-1]
    if not parts:
        return None, None
    if len(parts) == 1:
        return None, parts[0]
    return parts[0], " ".join(parts[1:])


def split_compound(full_name):
    """Split compound skipper strings into individual names."""
    if not full_name:
        return []
    parts = [p.strip() for p in COMPOUND_SPLITTERS.split(full_name) if p.strip()]
    if len(parts) <= 1:
        return [full_name]
    if all(len(p.split()) >= 2 for p in parts):
        return parts
    last_tokens = parts[-1].split()
    if len(last_tokens) >= 2:
        surname = last_tokens[-1]
        out = [f"{p} {surname}" for p in parts[:-1]]
        out.append(parts[-1])
        return out
    return parts


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%S")


# ------------------------------------------------------------------
# Database helpers
# ------------------------------------------------------------------

def ensure_schema(con):
    cur = con.cursor()
    for table, col, coltype in SCHEMA_ADDITIONS:
        try:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {coltype}")
            print(f"  Added {table}.{col}", flush=True)
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                continue
            raise
    try:
        cur.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_rn_regatta_id "
            "ON regattas(rn_regatta_id) WHERE rn_regatta_id IS NOT NULL"
        )
    except sqlite3.OperationalError:
        pass
    con.commit()


def upsert_regatta(cur, rn_id, name, start_date, club_venue):
    cur.execute(
        "SELECT id FROM regattas WHERE rn_regatta_id = ? LIMIT 1",
        (str(rn_id),)
    )
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute("""
        INSERT INTO regattas
            (event_name, start_date, platform, is_completed,
             rn_regatta_id, parsed_at)
        VALUES (?, ?, 'RegattaNetwork', 1, ?, datetime('now'))
    """, (name or "(untitled)", start_date or None, str(rn_id)))
    return cur.lastrowid


def upsert_boat(cur, boat_name, sail_number):
    display = boat_name or sail_number or None
    name_lower = display.lower().strip() if display else None
    if name_lower:
        cur.execute(
            "SELECT id FROM boats WHERE lower(name) = ? LIMIT 1",
            (name_lower,)
        )
        row = cur.fetchone()
        if row:
            return row[0]
    cur.execute("""
        INSERT INTO boats
            (yacht_scoring_boat_id, name, rn_sail_number, parsed_at)
        VALUES (NULL, ?, ?, datetime('now'))
    """, (display, sail_number or None))
    return cur.lastrowid


def upsert_sailor(cur, full_name, club_raw=None):
    full = (full_name or "").strip()
    if not full:
        return None
    norm      = normalize_name(full)
    club_norm = normalize_club(club_raw) if club_raw else None

    if club_norm:
        cur.execute(
            "SELECT id FROM sailors WHERE name_normalized=? AND club_normalized=? LIMIT 1",
            (norm, club_norm)
        )
        row = cur.fetchone()
        if row:
            return row[0]

    cur.execute(
        "SELECT id FROM sailors WHERE name_normalized=? LIMIT 1",
        (norm,)
    )
    row = cur.fetchone()
    if row:
        return row[0]

    first, last = split_name(full)
    confidence  = "name+club" if club_norm else "name_only"
    cur.execute("""
        INSERT INTO sailors
            (full_name, first_name, last_name, match_confidence,
             name_normalized, club, club_normalized, parsed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    """, (full, first, last, confidence, norm, club_raw or None, club_norm or None))
    return cur.lastrowid


def insert_participation(cur, sailor_id, boat_id, regatta_id, role, fleet_name):
    try:
        cur.execute("""
            INSERT INTO participation
                (sailor_id, boat_id, regatta_id, role, cs_class_name)
            VALUES (?, ?, ?, ?, ?)
        """, (sailor_id, boat_id, regatta_id, role, fleet_name or None))
    except sqlite3.IntegrityError:
        pass


# ------------------------------------------------------------------
# HTML parsing
# ------------------------------------------------------------------

def extract_text(td_html):
    """Extract clean text from a td's inner HTML."""
    return clean(td_html)


def parse_thead_columns(thead_html):
    """
    Returns ordered list of column role strings for this fleet table.
    Roles: 'pos','sail','boat','rating','skipper','club','corrected','race','total','spacer'
    """
    cells = re.findall(r"<td[^>]*>(.*?)</td>", thead_html, re.DOTALL)
    cols  = []
    for cell in cells:
        text = clean(cell).lower()
        # race number link detection
        if 'race_num=' in cell or re.match(r'^\d+$', text):
            cols.append("race")
        elif not text:
            cols.append("spacer")
        elif "pos" in text:
            cols.append("pos")
        elif text.startswith("sail"):
            cols.append("sail")
        elif text.startswith("boat"):
            cols.append("boat")
        elif "rating" in text:
            cols.append("rating")
        elif "skipper" in text:
            cols.append("skipper")
        elif "yacht club" in text or "club" in text:
            cols.append("club")
        elif "corrected" in text:
            cols.append("corrected")
        elif "total" in text:
            cols.append("total")
        else:
            cols.append("other")
    return cols


def parse_row(tr_html, col_map):
    """
    Extract fields from a result row given a col_map list.
    Returns dict with keys: skipper, boat, sail, club, data_skipper
    """
    cells = re.findall(r"<td[^>]*>(.*?)</td>", tr_html, re.DOTALL)

    # Try data-skipper attribute first — cleanest source
    ds_match = re.search(r'data-skipper="([^"]*)"', tr_html)
    data_skipper = ds_match.group(1).strip() if ds_match else None

    result = {"skipper": None, "boat": None, "sail": None, "club": None,
              "data_skipper": data_skipper}

    for i, role in enumerate(col_map):
        if i >= len(cells):
            break
        val = extract_text(cells[i])
        # Strip trailing whitespace artifacts
        val = val.rstrip("\xa0 \t")
        if not val:
            continue
        if role == "skipper" and result["skipper"] is None:
            result["skipper"] = val
        elif role == "boat" and result["boat"] is None:
            result["boat"] = val
        elif role == "sail" and result["sail"] is None:
            result["sail"] = val
        elif role == "club" and result["club"] is None:
            result["club"] = val

    return result


def parse_date(date_str):
    """
    Try to extract a YYYY-MM-DD or YYYY from raw date string.
    Returns ISO date string or None.
    """
    if not date_str:
        return None
    # Try full date patterns
    for fmt, pat in [
        ("%B %d, %Y",   r"[A-Z][a-z]+ \d{1,2}, \d{4}"),
        ("%B %Y",       r"[A-Z][a-z]+ \d{4}"),
    ]:
        m = re.search(pat, date_str)
        if m:
            try:
                import datetime
                return datetime.datetime.strptime(m.group(), fmt).strftime("%Y-%m-%d")
            except ValueError:
                pass
    # Just grab the year
    m = re.search(r"\b(19|20)\d{2}\b", date_str)
    if m:
        return m.group() + "-01-01"
    return None


def parse_file(rn_id, html):
    """
    Parse one results.html. Returns list of dicts:
      {fleet, skipper_names: [str], boat_name, sail_number, club}
    Plus regatta metadata dict.
    """
    # --- Regatta metadata ---
    # Title: "Event Name - Series Standing"
    title_m = re.search(r"<title>\s*(.*?)\s*</title>", html, re.DOTALL)
    title_raw = clean(title_m.group(1)) if title_m else ""
    event_name = re.sub(r"\s*[-–]\s*Series Standing.*$", "", title_raw, flags=re.IGNORECASE).strip()

    # H4: "Event Name<br>    Club | Date"
    h4_m = re.search(r"<h4>(.*?)</h4>", html, re.DOTALL)
    h4_text = clean(h4_m.group(1)) if h4_m else ""
    # Split on pipe
    h4_parts   = h4_text.split("|")
    club_venue = h4_parts[0].strip() if h4_parts else ""
    # Remove event name from club_venue (it may be "EventName  ClubName")
    if event_name and club_venue.startswith(event_name):
        club_venue = club_venue[len(event_name):].strip()
    date_raw   = h4_parts[1].strip() if len(h4_parts) > 1 else ""
    start_date = parse_date(date_raw)

    meta = {
        "rn_id":      rn_id,
        "event_name": event_name or f"RN Event {rn_id}",
        "start_date": start_date,
        "club_venue": club_venue,
    }

    # --- Fleet tables ---
    entries = []

    # Find all fleet sections — each has an H2 with fleet name then a scoring table
    fleet_sections = re.split(r"(?=<h2>)", html)

    for section in fleet_sections:
        # Fleet name from H2 anchor name attribute
        fleet_m = re.search(r'name="([^"]+)"', section)
        if not fleet_m:
            continue
        fleet_name = fleet_m.group(1).strip()

        # thead
        thead_m = re.search(r"<thead>(.*?)</thead>", section, re.DOTALL)
        if not thead_m:
            continue
        col_map = parse_thead_columns(thead_m.group(1))

        if "skipper" not in col_map:
            continue

        # tbody
        tbody_m = re.search(r"<tbody[^>]*>(.*?)</tbody>", section, re.DOTALL)
        if not tbody_m:
            continue

        rows = re.findall(r"<tr>(.*?)</tr>", tbody_m.group(1), re.DOTALL)
        for tr in rows:
            fields = parse_row(tr, col_map)

            # Prefer data-skipper for clean name, fall back to skipper column
            raw_skipper = fields["data_skipper"] or fields["skipper"] or ""
            raw_skipper = strip_a_suffix(raw_skipper).strip()

            if not raw_skipper:
                continue

            skipper_names = split_compound(raw_skipper)
            skipper_names = [s.strip() for s in skipper_names if s.strip()]

            boat_name  = (fields["boat"] or "").strip() or None
            sail_raw   = (fields["sail"] or "").strip()
            sail_number = None if sail_raw.lower() in ("none", "", "n/a") else sail_raw or None
            club_raw   = (fields["club"] or "").strip() or None

            if skipper_names:
                entries.append({
                    "fleet":         fleet_name,
                    "skipper_names": skipper_names,
                    "boat_name":     boat_name,
                    "sail_number":   sail_number,
                    "club":          club_raw,
                })

    return meta, entries


# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------

def main():
    con = sqlite3.connect(DB_PATH, timeout=30)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=NORMAL")
    ensure_schema(con)
    cur = con.cursor()

    folders = sorted(
        (p for p in RAW_DIR.iterdir() if p.is_dir() and p.name.isdigit()),
        key=lambda p: int(p.name)
    )
    total   = len(folders)
    print(f"Found {total:,} folders in {RAW_DIR}/", flush=True)

    stats   = {"ok": 0, "empty": 0, "no_entries": 0, "errors": 0}
    started = time.time()

    for i, folder in enumerate(folders, 1):
        rn_id = int(folder.name)
        f     = folder / "results.html"

        if not f.exists() or f.stat().st_size == 0:
            stats["empty"] += 1
            continue

        try:
            html = f.read_text(encoding="iso-8859-1", errors="replace")
            meta, entries = parse_file(rn_id, html)

            if not entries:
                stats["no_entries"] += 1
                continue

            regatta_db_id = upsert_regatta(
                cur,
                meta["rn_id"],
                meta["event_name"],
                meta["start_date"],
                meta["club_venue"],
            )

            for entry in entries:
                boat_id = upsert_boat(cur, entry["boat_name"], entry["sail_number"])

                for j, skipper_name in enumerate(entry["skipper_names"]):
                    sailor_id = upsert_sailor(cur, skipper_name, entry["club"])
                    if sailor_id is None:
                        continue
                    role = "skipper" if j == 0 else "crew"
                    insert_participation(cur, sailor_id, boat_id, regatta_db_id,
                                        role, entry["fleet"])

            stats["ok"] += 1

        except Exception as e:
            stats["errors"] += 1
            print(f"  ERROR {rn_id}: {e}", flush=True)

        if i % 500 == 0 or i == total:
            con.commit()
            elapsed = time.time() - started
            rate    = i / elapsed if elapsed else 0
            eta     = (total - i) / rate / 60 if rate else 0
            print(
                f"  [{i:>6,}/{total:,}] {rate:.1f}/s  ETA {eta:.0f}m  {stats}",
                flush=True
            )

    con.commit()
    con.close()
    print(f"\nDone in {(time.time()-started)/60:.1f} min: {stats}", flush=True)


if __name__ == "__main__":
    main()