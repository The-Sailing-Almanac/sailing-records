"""
migrate_participation_v2.py

Makes boat_id nullable in participation table.
Required for ICSA which has no boats.
Preserves all existing data. Safe to re-run.
"""
import sqlite3

DB_PATH = "sailing_data.db"


def table_exists(cur, name):
    cur.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,))
    return cur.fetchone() is not None


def index_exists(cur, name):
    cur.execute("SELECT 1 FROM sqlite_master WHERE type='index' AND name=?", (name,))
    return cur.fetchone() is not None


def get_columns(cur, table):
    cur.execute(f"PRAGMA table_info({table})")
    return [row[1] for row in cur.fetchall()]


def migrate():
    con = sqlite3.connect(DB_PATH, timeout=30)
    con.execute("PRAGMA journal_mode=WAL")
    cur = con.cursor()

    print("Checking state ...", flush=True)
    part_exists     = table_exists(cur, "participation")
    part_old_exists = table_exists(cur, "participation_old")

    print(f"  participation exists:     {part_exists}", flush=True)
    print(f"  participation_old exists: {part_old_exists}", flush=True)

    if part_exists and part_old_exists:
        print("  Partial previous run — dropping incomplete participation", flush=True)
        cur.execute("DROP TABLE participation")
        part_exists = False

    if part_old_exists and not part_exists:
        print("  Renaming participation_old back to participation", flush=True)
        cur.execute("ALTER TABLE participation_old RENAME TO participation")
        part_old_exists = False
        part_exists     = True

    if not part_exists:
        print("ERROR: no participation table found. Aborting.", flush=True)
        con.close()
        return

    # Drop manual indexes before rename
    for idx in ("idx_part_regatta", "idx_part_boat", "idx_part_sailor"):
        if index_exists(cur, idx):
            cur.execute(f"DROP INDEX {idx}")
            print(f"  Dropped {idx}", flush=True)

    cur.execute("ALTER TABLE participation RENAME TO participation_old")
    print("  Renamed participation -> participation_old", flush=True)

    # Detect which columns actually exist in participation_old
    old_cols = get_columns(cur, "participation_old")
    print(f"  Columns in participation_old: {old_cols}", flush=True)

    # New table — boat_id nullable, all ICSA columns included
    cur.execute("""
        CREATE TABLE participation (
            id              INTEGER PRIMARY KEY,
            sailor_id       INTEGER NOT NULL REFERENCES sailors(id),
            boat_id         INTEGER REFERENCES boats(id),
            regatta_id      INTEGER NOT NULL REFERENCES regattas(id),
            role            TEXT NOT NULL CHECK (role IN ('owner','skipper','crew','tactician')),
            cs_class_name   TEXT,
            school          TEXT,
            division        TEXT,
            graduation_year INTEGER,
            race_range      TEXT,
            UNIQUE (sailor_id, boat_id, regatta_id, role)
        )
    """)
    print("  Created new participation table (boat_id nullable)", flush=True)

    # Only copy columns that exist in both old and new table
    new_cols     = get_columns(cur, "participation")
    shared_cols  = [c for c in new_cols if c in old_cols]
    cols_str     = ", ".join(shared_cols)
    print(f"  Copying shared columns: {shared_cols}", flush=True)

    cur.execute(f"""
        INSERT INTO participation ({cols_str})
        SELECT {cols_str} FROM participation_old
    """)
    row_count = cur.rowcount
    print(f"  Copied {row_count:,} rows", flush=True)

    cur.execute("CREATE INDEX idx_part_regatta ON participation(regatta_id)")
    cur.execute("CREATE INDEX idx_part_boat    ON participation(boat_id) WHERE boat_id IS NOT NULL")
    cur.execute("CREATE INDEX idx_part_sailor  ON participation(sailor_id)")
    print("  Recreated indexes", flush=True)

    cur.execute("DROP TABLE participation_old")
    print("  Dropped participation_old", flush=True)

    con.commit()

    # Verify
    cur.execute("SELECT COUNT(*) FROM participation")
    print(f"\nVerification: {cur.fetchone()[0]:,} rows in participation", flush=True)
    cur.execute("SELECT role, COUNT(*) FROM participation GROUP BY role")
    for row in cur.fetchall():
        print(f"  {row[0]:15s} {row[1]:>10,}", flush=True)
    cur.execute("SELECT sql FROM sqlite_master WHERE name='participation'")
    print(f"\nNew DDL:\n{cur.fetchone()[0]}", flush=True)

    con.close()
    print("\nMigration complete.", flush=True)


if __name__ == "__main__":
    migrate()