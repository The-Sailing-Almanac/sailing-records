"""
parser.py

Reads raw JSON from raw/{eID}/ and populates sailing_data.db with:
  - regattas (one row per event)
  - boats    (one row per boat, deduped by yacht_scoring_boat_id)
  - sailors  (one row per unique person, deduped where possible)
  - participation (sailor x boat x regatta x role)
  - race_results  (boat x regatta x race, with score and finish code)

Idempotent: re-running picks up new regattas and re-applies changes
to existing ones without duplicating rows.

CHANGES from v1:
  - Compound owner strings split into separate sailors at parse time
    ('Joerg Esdorn / Duncan Hennes' -> two sailor rows).
  - Club names normalized to canonical form so 'American Yacht Club',
    'American YC', 'American' all match each other for dedup.
"""
import json
import re
import sqlite3
import time
from pathlib import Path

RAW_DIR = Path("raw")
DB_PATH = "sailing_data.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS regattas (
    id              INTEGER PRIMARY KEY,
    event_name      TEXT NOT NULL,
    start_date      TEXT,
    end_date        TEXT,
    city            TEXT,
    state           TEXT,
    country         TEXT,
    platform        TEXT NOT NULL DEFAULT 'YachtScoring',
    is_completed    INTEGER,
    raw_event_url   TEXT,
    parsed_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS boats (
    id                      INTEGER PRIMARY KEY,
    yacht_scoring_boat_id   INTEGER UNIQUE NOT NULL,
    name                    TEXT,
    design                  TEXT,
    length                  REAL,
    first_seen_event_id     INTEGER,
    parsed_at               TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_boats_name ON boats(name);

CREATE TABLE IF NOT EXISTS sailors (
    id                  INTEGER PRIMARY KEY,
    full_name           TEXT NOT NULL,
    first_name          TEXT,
    last_name           TEXT,
    world_sailing_id    TEXT,
    us_sailing_id       TEXT,
    club                TEXT,
    club_normalized     TEXT,
    city                TEXT,
    state               TEXT,
    country             TEXT,
    match_confidence    TEXT NOT NULL CHECK (match_confidence IN ('id','name+club','name_only')),
    name_normalized     TEXT NOT NULL,
    family_id           INTEGER,
    parsed_at           TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sailors_ws ON sailors(world_sailing_id) WHERE world_sailing_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sailors_us ON sailors(us_sailing_id) WHERE us_sailing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sailors_name_club ON sailors(name_normalized, club_normalized);
CREATE INDEX IF NOT EXISTS idx_sailors_name ON sailors(name_normalized);
CREATE INDEX IF NOT EXISTS idx_sailors_last ON sailors(last_name);

CREATE TABLE IF NOT EXISTS participation (
    id           INTEGER PRIMARY KEY,
    sailor_id    INTEGER NOT NULL REFERENCES sailors(id),
    boat_id      INTEGER NOT NULL REFERENCES boats(id),
    regatta_id   INTEGER NOT NULL REFERENCES regattas(id),
    role         TEXT NOT NULL CHECK (role IN ('owner','crew','tactician')),
    UNIQUE (sailor_id, boat_id, regatta_id, role)
);
CREATE INDEX IF NOT EXISTS idx_part_regatta ON participation(regatta_id);
CREATE INDEX IF NOT EXISTS idx_part_boat ON participation(boat_id);
CREATE INDEX IF NOT EXISTS idx_part_sailor ON participation(sailor_id);

CREATE TABLE IF NOT EXISTS race_results (
    id                  INTEGER PRIMARY KEY,
    regatta_id          INTEGER NOT NULL REFERENCES regattas(id),
    boat_id             INTEGER NOT NULL REFERENCES boats(id),
    class_name          TEXT,
    division_name       TEXT,
    circle_name         TEXT,
    race_number         INTEGER NOT NULL,
    finish_status       TEXT,
    race_value          REAL,
    sort_value          REAL,
    UNIQUE (regatta_id, boat_id, race_number)
);
CREATE INDEX IF NOT EXISTS idx_race_regatta_boat ON race_results(regatta_id, boat_id);

CREATE TABLE IF NOT EXISTS parsed_events (
    regatta_id  INTEGER PRIMARY KEY,
    parsed_at   TEXT NOT NULL,
    boats_count INTEGER,
    sailors_count INTEGER
);
"""

# --- helpers -----------------------------------------------------------

NAME_PUNCT = re.compile(r"[^\w\s]")
NAME_SPACE = re.compile(r"\s+")
COMPOUND_SPLITTERS = re.compile(r"\s*(?:/|&|\sand\s|\swith\s)\s*", re.IGNORECASE)

# Tokens to strip from club names. Order matters — longer first.
CLUB_STRIP_TOKENS = [
    "yacht club", "sailing club", "yacht squadron", "sailing society",
    "sailing association", "boat club", "sail club",
    "y.c.", "yc",
    "s.c.", "sc",
    "y. c.", "y c",
    "club", "yacht", "association", "society",
]


def normalize_name(s: str) -> str:
    if not s:
        return ""
    s = s.lower().strip()
    s = NAME_PUNCT.sub("", s)
    s = NAME_SPACE.sub(" ", s)
    return s.strip()


def normalize_club(s: str) -> str:
    """
    Canonicalize a club name for matching.
      'American Yacht Club' -> 'american'
      'American YC'         -> 'american'
      'American'            -> 'american'
      'New York YC'         -> 'new york'
      'NATYC'               -> 'natyc' (acronyms stay as-is)
    """
    if not s:
        return ""
    s = s.lower().strip()
    s = NAME_PUNCT.sub(" ", s)
    s = NAME_SPACE.sub(" ", s).strip()
    if not s:
        return ""
    # Strip trailing club-type tokens
    changed = True
    while changed:
        changed = False
        for token in CLUB_STRIP_TOKENS:
            if s.endswith(" " + token):
                s = s[: -(len(token) + 1)].strip()
                changed = True
                break
            if s == token:
                s = ""
                changed = True
                break
    return s.strip()


def split_compound_name(full_name: str):
    """
    Split joint-owner strings into individual names.
      'Mark & Jolene Masur'           -> ['Mark Masur', 'Jolene Masur']
      'Roy / Marina Lamphier'         -> ['Roy Lamphier', 'Marina Lamphier']
      'Joerg Esdorn / Duncan Hennes'  -> ['Joerg Esdorn', 'Duncan Hennes']
      'Will Monts'                    -> ['Will Monts']
      'Esdorn/Hennes'                 -> ['Esdorn', 'Hennes']
    """
    if not full_name:
        return []
    full_name = full_name.strip()
    if not full_name:
        return []

    parts = [p.strip() for p in COMPOUND_SPLITTERS.split(full_name) if p.strip()]
    if len(parts) <= 1:
        return [full_name]

    # Case A: every part already has 2+ words -> independent full names
    # e.g. 'Joerg Esdorn / Duncan Hennes' -> ['Joerg Esdorn', 'Duncan Hennes']
    if all(len(p.split()) >= 2 for p in parts):
        return parts

    # Case B: the last part is a multi-word name, earlier parts are bare
    # first names sharing that surname.
    # e.g. 'Mark & Jolene Masur' -> last='Jolene Masur', earlier=['Mark']
    last_part = parts[-1]
    last_tokens = last_part.split()
    if len(last_tokens) >= 2:
        surname = last_tokens[-1]
        out = [f"{p} {surname}" for p in parts[:-1]]
        out.append(last_part)
        return out

    # Case C: all parts are single tokens — 'Esdorn/Hennes'.
    # Could be surnames of two unrelated people. We keep them split,
    # treating each token as a sailor.
    return parts


def split_name(full: str):
    """Best-effort first/last split for a single sailor's name."""
    parts = (full or "").strip().split()
    # Drop trailing suffixes like Jr., Sr., III
    suffix_set = {"jr", "jr.", "sr", "sr.", "ii", "iii", "iv"}
    while len(parts) > 1 and parts[-1].lower().strip(".") in suffix_set:
        parts = parts[:-1]
    if not parts:
        return None, None
    if len(parts) == 1:
        return None, parts[0]
    return parts[0], " ".join(parts[1:])


def load_json(path: Path):
    if not path.exists():
        return None
    try:
        text = path.read_text(encoding="utf-8")
        if not text.strip():
            return None
        return json.loads(text)
    except (json.JSONDecodeError, OSError):
        return None


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%S")


# --- sailor upsert -----------------------------------------------------

def upsert_sailor_structured(con, owner_block, override_full_name=None):
    """
    Upsert sailor from a structured 'owner' object. Returns sailor id.
    If override_full_name is provided, use it (for split compounds).
    """
    profile = owner_block.get("userProfile") or {}
    ws = (profile.get("worldSailingNumber") or "").strip() or None
    us = (profile.get("usSailingNumber") or "").strip() or None
    club_raw = (owner_block.get("club") or "").strip() or None
    club_norm = normalize_club(club_raw) if club_raw else None
    city = (owner_block.get("city") or "").strip() or None
    state = (owner_block.get("state") or "").strip() or None
    country = (owner_block.get("country") or "").strip() or None

    if override_full_name:
        full = override_full_name.strip()
        first, last = split_name(full)
        # IDs only attach to the original (un-split) sailor record. After
        # splitting a compound, we can't know which ID belongs to which
        # person, so we drop them.
        ws = None
        us = None
    else:
        first = (owner_block.get("firstName") or "").strip() or None
        last = (owner_block.get("lastName") or "").strip() or None
        full = " ".join(p for p in [first, last] if p) or "(unknown)"

    norm = normalize_name(full)

    # ID-based lookup first (most reliable)
    if ws:
        row = con.execute("SELECT id FROM sailors WHERE world_sailing_id = ?",
                          (ws,)).fetchone()
        if row:
            return row[0]
    if us:
        row = con.execute("SELECT id FROM sailors WHERE us_sailing_id = ?",
                          (us,)).fetchone()
        if row:
            return row[0]

    # Name + normalized club
    if club_norm:
        row = con.execute("""
            SELECT id FROM sailors
            WHERE name_normalized = ? AND club_normalized = ?
        """, (norm, club_norm)).fetchone()
        if row:
            return row[0]

    confidence = "id" if (ws or us) else ("name+club" if club_norm else "name_only")
    cur = con.execute("""
        INSERT INTO sailors (full_name, first_name, last_name,
            world_sailing_id, us_sailing_id, club, club_normalized,
            city, state, country,
            match_confidence, name_normalized, parsed_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (full, first, last, ws, us, club_raw, club_norm,
          city, state, country, confidence, norm, now_iso()))
    return cur.lastrowid


def upsert_sailor_by_name(con, full_name):
    """Upsert sailor from a flat crew-name string. Returns sailor id."""
    full = (full_name or "").strip()
    if not full:
        return None
    norm = normalize_name(full)
    first, last = split_name(full)

    # Dedupe within name_only tier by normalized name
    row = con.execute("""
        SELECT id FROM sailors
        WHERE name_normalized = ? AND match_confidence = 'name_only'
    """, (norm,)).fetchone()
    if row:
        return row[0]

    cur = con.execute("""
        INSERT INTO sailors (full_name, first_name, last_name,
            match_confidence, name_normalized, parsed_at)
        VALUES (?,?,?,?,?,?)
    """, (full, first, last, "name_only", norm, now_iso()))
    return cur.lastrowid


# --- boat upsert -------------------------------------------------------

def upsert_boat(con, boat_block, regatta_id):
    ys_id = boat_block.get("eventBoatId")
    if ys_id is None:
        return None
    name = (boat_block.get("name") or "").strip() or None
    design = (boat_block.get("design") or "").strip() or None
    length_raw = boat_block.get("length")
    try:
        length = float(length_raw) if length_raw not in (None, "") else None
    except (TypeError, ValueError):
        length = None

    row = con.execute("SELECT id FROM boats WHERE yacht_scoring_boat_id = ?",
                      (ys_id,)).fetchone()
    if row:
        con.execute("""
            UPDATE boats SET
                name = COALESCE(?, name),
                design = COALESCE(?, design),
                length = COALESCE(?, length)
            WHERE id = ?
        """, (name, design, length, row[0]))
        return row[0]
    cur = con.execute("""
        INSERT INTO boats (yacht_scoring_boat_id, name, design, length,
            first_seen_event_id, parsed_at)
        VALUES (?,?,?,?,?,?)
    """, (ys_id, name, design, length, regatta_id, now_iso()))
    return cur.lastrowid


# --- main per-regatta parse --------------------------------------------

def parse_regatta(con, eid: int) -> dict:
    folder = RAW_DIR / str(eid)

    if (folder / "_missing.flag").exists() or (folder / "_error.flag").exists():
        return {"skipped": "flagged"}

    event = load_json(folder / "event.json")
    boats_data = load_json(folder / "boats.json")
    cumul = load_json(folder / "cumulative.json")

    if not event or not isinstance(event, dict):
        return {"skipped": "no_event"}

    regatta_id = event.get("id")
    if regatta_id is None:
        return {"skipped": "no_regatta_id"}

    con.execute("""
        INSERT INTO regattas (id, event_name, start_date, end_date,
            city, state, country, platform, is_completed, raw_event_url, parsed_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
            event_name = excluded.event_name,
            start_date = excluded.start_date,
            end_date = excluded.end_date,
            city = excluded.city,
            state = excluded.state,
            country = excluded.country,
            is_completed = excluded.is_completed,
            parsed_at = excluded.parsed_at
    """, (
        regatta_id,
        (event.get("name") or "").strip() or "(untitled)",
        event.get("startDate"),
        event.get("endDate"),
        (event.get("city") or "").strip() or None,
        (event.get("state") or "").strip() or None,
        (event.get("country") or "").strip() or None,
        "YachtScoring",
        1 if event.get("isCompleted") else 0,
        (event.get("eventUrl") or "").strip() or None,
        now_iso(),
    ))

    counts = {"boats": 0, "sailors": 0, "participations": 0, "race_results": 0}

    if boats_data and isinstance(boats_data, dict):
        for entry in boats_data.get("rows", []) or []:
            ys_id = entry.get("boatId")
            if ys_id is None:
                continue
            boat_block = {
                "eventBoatId": ys_id,
                "name": entry.get("name"),
                "design": entry.get("design"),
                "length": entry.get("length"),
            }
            boat_id = upsert_boat(con, boat_block, regatta_id)
            if boat_id is None:
                continue
            counts["boats"] += 1

            # ---- Owners (with compound splitting) ----
            owner = entry.get("owner") or {}
            owner_first = (owner.get("firstName") or "").strip()
            owner_last = (owner.get("lastName") or "").strip()
            owner_full = " ".join(p for p in [owner_first, owner_last] if p).strip()

            owner_sailor_ids = []
            if owner_full:
                pieces = split_compound_name(owner_full)
                if len(pieces) == 1:
                    sid = upsert_sailor_structured(con, owner)
                    owner_sailor_ids.append(sid)
                    counts["sailors"] += 1
                else:
                    # Multi-person ownership: create a sailor for each.
                    # Each piece inherits club/city/state but NOT the
                    # federation IDs (which belong to only one person).
                    for piece in pieces:
                        sid = upsert_sailor_structured(con, owner,
                                                      override_full_name=piece)
                        owner_sailor_ids.append(sid)
                        counts["sailors"] += 1

            for sid in owner_sailor_ids:
                con.execute("""
                    INSERT OR IGNORE INTO participation
                        (sailor_id, boat_id, regatta_id, role)
                    VALUES (?,?,?,?)
                """, (sid, boat_id, regatta_id, "owner"))
                counts["participations"] += 1

            # ---- Tactician ----
            tact = (entry.get("crewTactician") or "").strip()
            if tact:
                for piece in split_compound_name(tact):
                    tact_id = upsert_sailor_by_name(con, piece)
                    if tact_id:
                        con.execute("""
                            INSERT OR IGNORE INTO participation
                                (sailor_id, boat_id, regatta_id, role)
                            VALUES (?,?,?,?)
                        """, (tact_id, boat_id, regatta_id, "tactician"))
                        counts["participations"] += 1

            # ---- Crew (also splits compounds) ----
            owner_norms = {normalize_name(p) for p in
                           (split_compound_name(owner_full) if owner_full else [])}
            for crew_name in entry.get("crewNames", []) or []:
                for piece in split_compound_name((crew_name or "").strip()):
                    if not piece:
                        continue
                    if normalize_name(piece) in owner_norms:
                        continue
                    cid = upsert_sailor_by_name(con, piece)
                    if cid:
                        con.execute("""
                            INSERT OR IGNORE INTO participation
                                (sailor_id, boat_id, regatta_id, role)
                            VALUES (?,?,?,?)
                        """, (cid, boat_id, regatta_id, "crew"))
                        counts["participations"] += 1

    # ---- race_results ----
    if cumul and isinstance(cumul, dict):
        for circle in cumul.get("data", []) or []:
            circle_name = circle.get("circleName")
            for div in circle.get("divisions", []) or []:
                division_name = div.get("divisionName")
                for cls in div.get("classes", []) or []:
                    class_name = cls.get("className")
                    for boat in cls.get("boats", []) or []:
                        ys_id = boat.get("eventBoatId")
                        if ys_id is None:
                            continue
                        boat_id = upsert_boat(con, boat, regatta_id)
                        if boat_id is None:
                            continue
                        for rec in boat.get("records", []) or []:
                            race_num = rec.get("raceNumber")
                            if race_num is None:
                                continue
                            con.execute("""
                                INSERT INTO race_results
                                    (regatta_id, boat_id, class_name, division_name,
                                     circle_name, race_number, finish_status,
                                     race_value, sort_value)
                                VALUES (?,?,?,?,?,?,?,?,?)
                                ON CONFLICT (regatta_id, boat_id, race_number) DO UPDATE SET
                                    class_name = excluded.class_name,
                                    division_name = excluded.division_name,
                                    circle_name = excluded.circle_name,
                                    finish_status = excluded.finish_status,
                                    race_value = excluded.race_value,
                                    sort_value = excluded.sort_value
                            """, (
                                regatta_id, boat_id, class_name, division_name,
                                circle_name, race_num,
                                rec.get("finishStatus"),
                                rec.get("raceValue"),
                                rec.get("sortValue"),
                            ))
                            counts["race_results"] += 1

    con.execute("""
        INSERT INTO parsed_events (regatta_id, parsed_at, boats_count, sailors_count)
        VALUES (?,?,?,?)
        ON CONFLICT(regatta_id) DO UPDATE SET
            parsed_at = excluded.parsed_at,
            boats_count = excluded.boats_count,
            sailors_count = excluded.sailors_count
    """, (regatta_id, now_iso(), counts["boats"], counts["sailors"]))

    return counts


def main():
    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=NORMAL")
    con.executescript(SCHEMA)
    con.commit()

    folders = sorted(
        (p for p in RAW_DIR.iterdir() if p.is_dir() and p.name.isdigit()),
        key=lambda p: int(p.name),
    )

    total = len(folders)
    print(f"Found {total:,} regatta folders in {RAW_DIR}/", flush=True)

    stats = {"ok": 0, "skipped_flagged": 0, "skipped_no_event": 0,
             "skipped_no_regatta_id": 0, "errors": 0}
    started = time.time()

    for i, folder in enumerate(folders, 1):
        eid = int(folder.name)
        try:
            result = parse_regatta(con, eid)
            if "skipped" in result:
                key = f"skipped_{result['skipped']}"
                stats[key] = stats.get(key, 0) + 1
            else:
                stats["ok"] += 1
        except Exception as e:
            stats["errors"] += 1
            print(f"  [{eid}] EXCEPTION: {e}", flush=True)

        if i % 100 == 0 or i == total:
            con.commit()
            elapsed = time.time() - started
            rate = i / elapsed if elapsed else 0
            remaining = (total - i) / rate if rate else 0
            print(f"[{i:>6}/{total:,}] {stats}  {rate:.1f}/s, ~{remaining/60:.1f}m left",
                  flush=True)

    con.commit()
    con.close()
    print(f"\nDone in {(time.time()-started)/60:.2f} min: {stats}", flush=True)


if __name__ == "__main__":
    main()