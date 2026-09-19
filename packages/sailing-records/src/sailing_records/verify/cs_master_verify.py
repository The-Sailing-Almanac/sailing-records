"""
cs_master_verify.py

Comprehensive verification before writing the final Clubspot harvester.
Checks:
  1. Local database schema, constraints, and indexes
  2. Existing data state (row counts, sample rows)
  3. Clubspot Parse API behavior (counts, pagination, field structure)
  4. Edge cases (registrations >1000, missing fields, data types)
"""
import json
import sqlite3
import urllib.request

DB_PATH = "sailing_data.db"
BASE    = "https://theclubspot.com/parse/classes"
APP_ID  = "myclubspot2017"
CLIENT  = "js4.3.1-forked-1.2.0"

# ----------------------------------------------------------------------
# Section 1: Local database
# ----------------------------------------------------------------------

def section(title):
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


def check_local_db():
    section("LOCAL DATABASE: schema, constraints, indexes")
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    for table in ("regattas", "participation", "boats", "sailors"):
        print(f"\n--- {table} columns ---")
        cur.execute(f"PRAGMA table_info({table})")
        for row in cur.fetchall():
            cid, name, coltype, notnull, dflt, pk = row
            flags = []
            if notnull: flags.append("NOT NULL")
            if pk:      flags.append("PRIMARY KEY")
            if dflt:    flags.append(f"DEFAULT {dflt}")
            flags_str = "  " + " ".join(flags) if flags else ""
            print(f"  {name:30s} {coltype:10s}{flags_str}")

        print(f"--- {table} indexes ---")
        cur.execute(f"PRAGMA index_list({table})")
        indexes = cur.fetchall()
        if not indexes:
            print("  (no indexes)")
        for idx in indexes:
            seq, idx_name, unique, origin, partial = idx
            unique_str = "UNIQUE" if unique else "non-unique"
            print(f"  {idx_name}  ({unique_str}, origin={origin})")
            cur.execute(f"PRAGMA index_info('{idx_name}')")
            for col in cur.fetchall():
                print(f"      column: {col[2]}")

    section("LOCAL DATABASE: row counts by platform")
    cur.execute("SELECT platform, COUNT(*) FROM regattas GROUP BY platform")
    for row in cur.fetchall():
        print(f"  {row[0]:20s} {row[1]:>8,} regattas")

    cur.execute("SELECT COUNT(*) FROM sailors")
    print(f"  sailors total:       {cur.fetchone()[0]:>8,}")
    cur.execute("SELECT COUNT(*) FROM boats")
    print(f"  boats total:         {cur.fetchone()[0]:>8,}")
    cur.execute("SELECT COUNT(*) FROM participation")
    print(f"  participation total: {cur.fetchone()[0]:>8,}")

    section("LOCAL DATABASE: sample rows from each table")
    for table in ("regattas", "sailors", "boats", "participation"):
        print(f"\n--- {table} sample row ---")
        cur.execute(f"SELECT * FROM {table} LIMIT 1")
        row = cur.fetchone()
        if row is None:
            print("  (empty)")
            continue
        col_names = [d[0] for d in cur.description]
        for name, val in zip(col_names, row):
            shown = str(val)
            if len(shown) > 80:
                shown = shown[:77] + "..."
            print(f"  {name:30s} {shown}")

    con.close()


# ----------------------------------------------------------------------
# Section 2: Clubspot API
# ----------------------------------------------------------------------

def parse_post(classname, payload):
    url = f"{BASE}/{classname}"
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


def check_clubspot_api():
    section("CLUBSPOT API: total counts")

    # Total regattas, no filter
    r = parse_post("regattas", {"where": {}, "limit": 0, "count": 1})
    total_regattas = r.get("count", 0)
    print(f"  All regattas:                            {total_regattas:>8,}")

    # With public=True filter
    r = parse_post("regattas", {
        "where": {"public": True},
        "limit": 0, "count": 1
    })
    print(f"  Where public=True:                       {r.get('count', 0):>8,}")

    # With archived=False filter
    r = parse_post("regattas", {
        "where": {"archived": False},
        "limit": 0, "count": 1
    })
    print(f"  Where archived=False:                    {r.get('count', 0):>8,}")

    # Both filters
    r = parse_post("regattas", {
        "where": {"public": True, "archived": False},
        "limit": 0, "count": 1
    })
    print(f"  Where public=True AND archived=False:    {r.get('count', 0):>8,}")

    # Registrations total
    r = parse_post("registrations", {"where": {}, "limit": 0, "count": 1})
    print(f"\n  All registrations:                       {r.get('count', 0):>8,}")

    r = parse_post("registrations", {
        "where": {"status": "confirmed"},
        "limit": 0, "count": 1
    })
    print(f"  Where status=confirmed:                  {r.get('count', 0):>8,}")

    r = parse_post("registrations", {
        "where": {"status": "confirmed", "archived": False},
        "limit": 0, "count": 1
    })
    print(f"  Where confirmed AND archived=False:      {r.get('count', 0):>8,}")

    section("CLUBSPOT API: do any regattas have >1000 registrations?")
    # Probe a few large-looking regattas
    r = parse_post("regattas", {
        "where": {},
        "limit": 20,
        "order": "-registrations",
    })
    overflow_count = 0
    for reg in r.get("results", []):
        cnt = reg.get("registrations", 0) or 0
        marker = "  <-- OVER 1000" if cnt > 1000 else ""
        print(f"  {cnt:>5}  {reg['objectId']}  {reg.get('name','')[:50]}{marker}")
        if cnt > 1000:
            overflow_count += 1
    print(f"\n  Total regattas with >1000 registrations in this sample: {overflow_count}")
    print("  (if any exist, fetch_registrations needs pagination)")

    section("CLUBSPOT API: full sample regatta record")
    r = parse_post("regattas", {"where": {}, "limit": 1})
    if r.get("results"):
        print(json.dumps(r["results"][0], indent=2, default=str))

    section("CLUBSPOT API: full sample registration record")
    r = parse_post("registrations", {
        "where": {"status": "confirmed"},
        "include": "boatClassObject,subclassesArray,participantsArray",
        "limit": 1,
    })
    if r.get("results"):
        print(json.dumps(r["results"][0], indent=2, default=str))

    section("CLUBSPOT API: registration field frequency in sample of 50")
    r = parse_post("registrations", {
        "where": {"status": "confirmed"},
        "include": "boatClassObject,subclassesArray,participantsArray",
        "limit": 50,
    })
    field_counts = {}
    for reg in r.get("results", []):
        for key, val in reg.items():
            if val not in (None, "", [], {}):
                field_counts[key] = field_counts.get(key, 0) + 1
    for key in sorted(field_counts, key=field_counts.get, reverse=True):
        print(f"  {field_counts[key]:>3}/50  {key}")

    section("CLUBSPOT API: participantsArray content sample")
    # Find a registration with crew so we can see the structure
    for reg in r.get("results", []):
        participants = reg.get("participantsArray") or []
        if len(participants) > 0:
            print(f"  Found registration {reg['objectId']} with {len(participants)} participants:")
            print(json.dumps(participants[0], indent=2, default=str))
            break
    else:
        print("  No registrations with participantsArray content in sample.")


def main():
    print("=" * 70)
    print("CLUBSPOT MASTER VERIFICATION")
    print("=" * 70)
    check_local_db()
    check_clubspot_api()
    print("\n" + "=" * 70)
    print("Done.")
    print("=" * 70)


if __name__ == "__main__":
    main()