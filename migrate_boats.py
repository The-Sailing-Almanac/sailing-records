"""
migrate_boats.py

Migrates boats table so yacht_scoring_boat_id allows NULL.
Handles partial/failed previous migration attempts gracefully.
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

    print("Checking database state ...", flush=True)

    boats_exists     = table_exists(cur, "boats")
    boats_old_exists = table_exists(cur, "boats_old")

    print(f"  boats exists:     {boats_exists}", flush=True)
    print(f"  boats_old exists: {boats_old_exists}", flush=True)

    # If both exist, a previous run renamed boats -> boats_old
    # but failed before finishing. Drop the incomplete new boats table.
    if boats_exists and boats_old_exists:
        print("  Detected partial previous migration — dropping incomplete boats table", flush=True)
        cur.execute("DROP TABLE boats")
        boats_exists = False

    # If only boats_old exists, previous run got further — new table was dropped/never created
    # boats_old IS the real data, rename it back to boats and start fresh
    if boats_old_exists and not boats_exists:
        print("  boats_old exists but boats does not — renaming boats_old back to boats", flush=True)
        cur.execute("ALTER TABLE boats_old RENAME TO boats")
        boats_old_exists = False
        boats_exists     = True

    if not boats_exists:
        print("ERROR: no boats or boats_old table found. Aborting.", flush=True)
        con.close()
        return

    # Drop any manually created indexes (autoindexes can't be dropped directly)
    for idx in ("idx_boats_name", "idx_cs_sail_number"):
        if index_exists(cur, idx):
            cur.execute(f"DROP INDEX {idx}")
            print(f"  Dropped index {idx}", flush=True)

    # Rename real data to boats_old
    cur.execute("ALTER TABLE boats RENAME TO boats_old")
    print("  Renamed boats -> boats_old", flush=True)

    # Create new boats table — yacht_scoring_boat_id is nullable
    # Note: no UNIQUE constraint in DDL to avoid sqlite_autoindex issues
    # We create the unique index manually below with a WHERE clause
    cur.execute("""
        CREATE TABLE boats (
            id                    INTEGER PRIMARY KEY,
            yacht_scoring_boat_id INTEGER,
            name                  TEXT,
            design                TEXT,
            length                REAL,
            first_seen_event_id   INTEGER,
            parsed_at             TEXT NOT NULL,
            cs_sail_number        TEXT
        )
    """)
    print("  Created new boats table (yacht_scoring_boat_id nullable)", flush=True)

    # Copy all data from old table
    cur.execute("INSERT INTO boats SELECT * FROM boats_old")
    row_count = cur.rowcount
    print(f"  Copied {row_count:,} rows from boats_old", flush=True)

    # Recreate indexes
    cur.execute("CREATE INDEX idx_boats_name ON boats(name)")
    print("  Created idx_boats_name", flush=True)

    # Partial unique index — allows multiple NULLs, enforces unique on non-NULL only
    cur.execute("""
        CREATE UNIQUE INDEX idx_boats_ys_id
        ON boats(yacht_scoring_boat_id)
        WHERE yacht_scoring_boat_id IS NOT NULL
    """)
    print("  Created idx_boats_ys_id (unique where not null)", flush=True)

    # Drop old table
    cur.execute("DROP TABLE boats_old")
    print("  Dropped boats_old", flush=True)

    con.commit()

    # Verify
    cur.execute("SELECT COUNT(*) FROM boats")
    final_count = cur.fetchone()[0]
    print(f"\nVerification: boats table has {final_count:,} rows", flush=True)

    cur.execute("PRAGMA table_info(boats)")
    print("Final schema:", flush=True)
    for row in cur.fetchall():
        cid, name, coltype, notnull, dflt, pk = row
        flags = []
        if notnull: flags.append("NOT NULL")
        if pk:      flags.append("PRIMARY KEY")
        print(f"  {name:30s} {coltype:10s}  {'  '.join(flags)}", flush=True)

    con.close()
    print("\nMigration complete.", flush=True)


if __name__ == "__main__":
    migrate()