"""
migrate_participation.py

Fixes two issues in the participation table:
1. boat_id FK references broken 'boats_old' table — fix to 'boats'
2. CHECK constraint excludes 'skipper' — expand to include it

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


def migrate():
    con = sqlite3.connect(DB_PATH, timeout=30)
    con.execute("PRAGMA journal_mode=WAL")
    cur = con.cursor()

    print("Checking state ...", flush=True)
    part_exists     = table_exists(cur, "participation")
    part_old_exists = table_exists(cur, "participation_old")

    print(f"  participation exists:     {part_exists}", flush=True)
    print(f"  participation_old exists: {part_old_exists}", flush=True)

    # Clean up any partial previous run
    if part_exists and part_old_exists:
        print("  Partial previous run detected — dropping incomplete participation", flush=True)
        cur.execute("DROP TABLE participation")
        part_exists = False

    if part_old_exists and not part_exists:
        print("  Renaming participation_old back to participation", flush=True)
        cur.execute("ALTER TABLE participation RENAME TO participation")
        part_old_exists = False
        part_exists = True

    if not part_exists:
        print("ERROR: no participation table found. Aborting.", flush=True)
        con.close()
        return

    # Drop manually created indexes before rename
    for idx in ("idx_part_regatta", "idx_part_boat", "idx_part_sailor"):
        if index_exists(cur, idx):
            cur.execute(f"DROP INDEX {idx}")
            print(f"  Dropped {idx}", flush=True)

    # Rename existing table
    cur.execute("ALTER TABLE participation RENAME TO participation_old")
    print("  Renamed participation -> participation_old", flush=True)

    # Create new table with fixed FK and expanded CHECK
    cur.execute("""
        CREATE TABLE participation (
            id         INTEGER PRIMARY KEY,
            sailor_id  INTEGER NOT NULL REFERENCES sailors(id),
            boat_id    INTEGER NOT NULL REFERENCES boats(id),
            regatta_id INTEGER NOT NULL REFERENCES regattas(id),
            role       TEXT NOT NULL CHECK (role IN ('owner','skipper','crew','tactician')),
            cs_class_name TEXT,
            UNIQUE (sailor_id, boat_id, regatta_id, role)
        )
    """)
    print("  Created new participation table", flush=True)

    # Copy all data
    cur.execute("INSERT INTO participation SELECT * FROM participation_old")
    row_count = cur.rowcount
    print(f"  Copied {row_count:,} rows", flush=True)

    # Recreate indexes
    cur.execute("CREATE INDEX idx_part_regatta ON participation(regatta_id)")
    cur.execute("CREATE INDEX idx_part_boat    ON participation(boat_id)")
    cur.execute("CREATE INDEX idx_part_sailor  ON participation(sailor_id)")
    print("  Recreated indexes", flush=True)

    # Drop old table
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