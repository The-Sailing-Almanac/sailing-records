"""
cs_harvester.py

Pages through all Clubspot race regattas via the Parse REST API and
writes regatta metadata + registrations into sailing_data.db.

Filters registrations on type='regatta' to exclude camps.
Handles pagination for regattas with >1000 registrations.
No authentication required — public data only.
"""
import json
import sqlite3
import time
import urllib.request

DB_PATH = "sailing_data.db"
BASE    = "https://theclubspot.com/parse/classes"
APP_ID  = "myclubspot2017"
CLIENT  = "js4.3.1-forked-1.2.0"
SLEEP   = 0.25
BATCH   = 1000

SCHEMA_ADDITIONS = [
    ("regattas",      "cs_regatta_id",  "TEXT"),
    ("regattas",      "cs_club_id",     "TEXT"),
    ("boats",         "cs_sail_number", "TEXT"),
    ("participation", "cs_class_name",  "TEXT"),
]


def parse_post(classname, payload):
    url  = f"{BASE}/{classname}"
    payload["_ApplicationId"] = APP_ID
    payload["_ClientVersion"] = CLIENT
    payload["_method"]        = "GET"
    data = json.dumps(payload).encode("utf-8")
    req  = urllib.request.Request(
        url, data=data,
        headers={
            "Content-Type": "application/json",
            "User-Agent":   "Mozilla/5.0 (sailing-legacy-research)",
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


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
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_cs_regatta_id "
            "ON regattas(cs_regatta_id) WHERE cs_regatta_id IS NOT NULL"
        )
    except sqlite3.OperationalError:
        pass
    con.commit()


def fetch_all_regattas():
    out  = []
    skip = 0
    while True:
        result = parse_post("regattas", {
            "where": {},
            "limit": BATCH,
            "skip":  skip,
            "order": "createdAt",
        })
        batch = result.get("results", [])
        out.extend(batch)
        print(f"  Fetched {len(out):,} regattas so far ...", flush=True)
        if len(batch) < BATCH:
            break
        skip += BATCH
        time.sleep(SLEEP)
    return out


def fetch_registrations(regatta_id):
    """Fetch all confirmed race registrations for one regatta, with pagination."""
    out  = []
    skip = 0
    while True:
        result = parse_post("registrations", {
            "where": {
                "regattaObject": {
                    "__type":    "Pointer",
                    "className": "regattas",
                    "objectId":  regatta_id,
                },
                "type":     "regatta",
                "status":   "confirmed",
                "archived": False,
            },
            "include": "boatClassObject",
            "limit":   BATCH,
            "skip":    skip,
            "order":   "lastName",
        })
        batch = result.get("results", [])
        out.extend(batch)
        if len(batch) < BATCH:
            break
        skip += BATCH
        time.sleep(SLEEP)
    return out


def upsert_regatta(cur, r):
    cs_id = r["objectId"]
    cur.execute(
        "SELECT id FROM regattas WHERE cs_regatta_id = ? LIMIT 1",
        (cs_id,)
    )
    row = cur.fetchone()
    if row:
        return row[0]

    name       = r.get("name", "")
    start_date = (r.get("startDate") or {}).get("iso", "")[:10]
    city       = r.get("city", "")    or ""
    state      = r.get("state", "")   or ""
    country    = r.get("country", "") or ""
    club_id    = (r.get("clubObject") or {}).get("objectId", "")

    cur.execute("""
        INSERT INTO regattas
            (event_name, start_date, city, state, country, platform,
             is_completed, cs_regatta_id, cs_club_id, parsed_at)
        VALUES (?, ?, ?, ?, ?, 'Clubspot', 1, ?, ?, datetime('now'))
    """, (name, start_date, city, state, country, cs_id, club_id))
    return cur.lastrowid


def upsert_sailor(cur, first, last, club=None):
    full = f"{first} {last}".strip()
    norm = full.lower()
    cur.execute(
        "SELECT id FROM sailors WHERE name_normalized = ? LIMIT 1",
        (norm,)
    )
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute("""
        INSERT INTO sailors
            (full_name, first_name, last_name, match_confidence,
             name_normalized, club, parsed_at)
        VALUES (?, ?, ?, 'name_only', ?, ?, datetime('now'))
    """, (full, first or None, last or None, norm, club or None))
    return cur.lastrowid


def upsert_boat(cur, boat_name, boat_type, sail_number):
    display_name = boat_name or sail_number or boat_type or None
    name_lower   = display_name.lower().strip() if display_name else None

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
            (yacht_scoring_boat_id, name, design, cs_sail_number, parsed_at)
        VALUES (NULL, ?, ?, ?, datetime('now'))
    """, (display_name, boat_type or None, sail_number or None))
    return cur.lastrowid


def process_registration(cur, reg, regatta_db_id):
    first = reg.get("firstName", "") or ""
    last  = reg.get("lastName",  "") or ""
    if not first and not last:
        return False

    boat_name         = reg.get("boatName",   "") or ""
    boat_type         = reg.get("boatType",   "") or ""
    sail_raw          = reg.get("sailNumber", "") or ""
    club_name         = reg.get("clubName",   "") or ""
    class_obj         = reg.get("boatClassObject") or {}
    class_name        = class_obj.get("name", "") if isinstance(class_obj, dict) else ""
    participant_names = reg.get("participantNames") or []

    sailor_id = upsert_sailor(cur, first, last, club=club_name or None)
    boat_id   = upsert_boat(cur, boat_name, boat_type, sail_raw)

    # Insert skipper
    try:
        cur.execute("""
            INSERT INTO participation
                (sailor_id, boat_id, regatta_id, role, cs_class_name)
            VALUES (?, ?, ?, 'skipper', ?)
        """, (sailor_id, boat_id, regatta_db_id, class_name or None))
    except sqlite3.IntegrityError:
        pass

    # Insert crew from participantNames — skip index 0 which is the skipper
    skipper_norm = f"{first} {last}".strip().lower()
    for crew_name in participant_names[1:]:
        if not crew_name:
            continue
        if crew_name.strip().lower() == skipper_norm:
            continue
        parts      = crew_name.strip().split(maxsplit=1)
        crew_first = parts[0] if len(parts) > 0 else ""
        crew_last  = parts[1] if len(parts) > 1 else ""
        if not crew_first and not crew_last:
            continue
        crew_id = upsert_sailor(cur, crew_first, crew_last, club=club_name or None)
        try:
            cur.execute("""
                INSERT INTO participation
                    (sailor_id, boat_id, regatta_id, role, cs_class_name)
                VALUES (?, ?, ?, 'crew', ?)
            """, (crew_id, boat_id, regatta_db_id, class_name or None))
        except sqlite3.IntegrityError:
            pass

    return True


def main():
    con = sqlite3.connect(DB_PATH, timeout=30)
    con.execute("PRAGMA journal_mode=WAL")
    ensure_schema(con)
    cur = con.cursor()

    print("Fetching all Clubspot regattas ...", flush=True)
    regattas = fetch_all_regattas()
    print(f"  Total: {len(regattas):,} regattas", flush=True)

    counts  = {"regattas": 0, "registrations": 0, "errors": 0}
    started = time.time()

    for i, r in enumerate(regattas, 1):
        cs_id = r["objectId"]
        try:
            regatta_db_id = upsert_regatta(cur, r)
            regs          = fetch_registrations(cs_id)
            inserted      = 0
            for reg in regs:
                if process_registration(cur, reg, regatta_db_id):
                    inserted += 1
            counts["regattas"]      += 1
            counts["registrations"] += inserted
        except Exception as e:
            counts["errors"] += 1
            print(f"  ERROR {cs_id}: {e}", flush=True)

        if i % 100 == 0:
            con.commit()
            elapsed = time.time() - started
            rate    = i / elapsed
            eta_min = (len(regattas) - i) / rate / 60
            print(
                f"  [{i:,}/{len(regattas):,}] "
                f"{rate:.1f}/s  ETA {eta_min:.0f}m  "
                f"{counts}",
                flush=True
            )
        time.sleep(SLEEP)

    con.commit()
    con.close()
    print(f"\nDone. Final counts: {counts}", flush=True)


if __name__ == "__main__":
    main()