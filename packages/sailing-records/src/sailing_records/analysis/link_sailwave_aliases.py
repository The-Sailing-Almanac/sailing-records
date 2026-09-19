"""
link_sailwave_aliases.py

Adds high-confidence Sailwave sailor aliases to existing canonical identities.
This is intentionally conservative: it only links Sailwave sailors to
non-Sailwave sailors when both name_normalized and club_normalized match
exactly. It does not clear or rebuild the existing sailor_alias table.
"""
import sqlite3

DB_PATH = "sailing_data.db"


def main():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sailor_alias (
            sailor_id INTEGER PRIMARY KEY,
            canonical_id INTEGER NOT NULL
        )
    """)

    cur.execute("""
        WITH sailor_platforms AS (
            SELECT DISTINCT p.sailor_id, r.platform
            FROM participation p
            JOIN regattas r ON r.id = p.regatta_id
            WHERE p.sailor_id IS NOT NULL
        ),
        sailwave_sailors AS (
            SELECT s.id, s.name_normalized, s.club_normalized
            FROM sailors s
            JOIN sailor_platforms sp ON sp.sailor_id = s.id
            WHERE sp.platform = 'Sailwave'
              AND s.name_normalized IS NOT NULL
              AND s.name_normalized != ''
              AND s.club_normalized IS NOT NULL
              AND s.club_normalized != ''
        ),
        canonical_matches AS (
            SELECT
                sw.id AS sailor_id,
                MIN(other.id) AS canonical_id
            FROM sailwave_sailors sw
            JOIN sailors other
              ON other.name_normalized = sw.name_normalized
             AND other.club_normalized = sw.club_normalized
             AND other.id != sw.id
            JOIN sailor_platforms osp ON osp.sailor_id = other.id
            WHERE osp.platform != 'Sailwave'
            GROUP BY sw.id
        )
        INSERT INTO sailor_alias (sailor_id, canonical_id)
        SELECT sailor_id, canonical_id
        FROM canonical_matches
        WHERE sailor_id != canonical_id
        ON CONFLICT(sailor_id) DO UPDATE SET
            canonical_id = excluded.canonical_id
    """)
    changed = cur.rowcount
    con.commit()

    total = cur.execute("""
        SELECT count(*)
        FROM sailor_alias a
        JOIN participation p ON p.sailor_id = a.sailor_id
        JOIN regattas r ON r.id = p.regatta_id
        WHERE r.platform = 'Sailwave'
    """).fetchone()[0]
    con.close()
    print(f"changed_alias_rows: {changed}")
    print(f"sailwave_alias_rows: {total}")


if __name__ == "__main__":
    main()
