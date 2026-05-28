#!/usr/bin/env python3
"""
merge_sailwave_data.py

Merge local Sailwave rows into a copy of the authoritative database without
modifying existing non-Sailwave rows.

Usage:
    python ops/merge_sailwave_data.py local.db authoritative-copy.db
"""
import sqlite3
import sys


SAILWAVE = "Sailwave"


def rows(cur, sql, params=()):
    cur.execute(sql, params)
    return cur.fetchall()


def ensure_source_text(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS source_text (
            id              INTEGER PRIMARY KEY,
            entity_type     TEXT,
            entity_id       INTEGER,
            platform        TEXT,
            source_url      TEXT,
            source_language TEXT,
            field_name      TEXT,
            source_text     TEXT,
            source_context  TEXT,
            parsed_at       TEXT
        )
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_source_text_entity
        ON source_text(entity_type, entity_id)
    """)


def columns(cur, table):
    cur.execute(f"PRAGMA table_info({table})")
    return [row[1] for row in cur.fetchall()]


def copy_row(src_cur, dst_cur, table, old_id, id_map):
    table_cols = columns(src_cur, table)
    data_cols = [c for c in table_cols if c != "id"]
    src_cur.execute(
        f"SELECT {', '.join(data_cols)} FROM {table} WHERE id=?",
        (old_id,),
    )
    row = src_cur.fetchone()
    if not row:
        return None
    values = list(row)
    for i, col in enumerate(data_cols):
        if table == "sailors" and col in ("world_sailing_id", "us_sailing_id", "slug") and values[i] == "":
            values[i] = None
        if table == "boats" and col == "yacht_scoring_boat_id" and values[i] == "":
            values[i] = None
    value_by_col = dict(zip(data_cols, values))
    if table == "sailors":
        for col in ("world_sailing_id", "us_sailing_id", "slug"):
            value = value_by_col.get(col)
            if value:
                dst_cur.execute(f"SELECT id FROM sailors WHERE {col}=? LIMIT 1", (value,))
                existing = dst_cur.fetchone()
                if existing:
                    id_map[old_id] = existing[0]
                    return existing[0]
    if table == "boats" and value_by_col.get("yacht_scoring_boat_id"):
        dst_cur.execute(
            "SELECT id FROM boats WHERE yacht_scoring_boat_id=? LIMIT 1",
            (value_by_col["yacht_scoring_boat_id"],),
        )
        existing = dst_cur.fetchone()
        if existing:
            id_map[old_id] = existing[0]
            return existing[0]
    placeholders = ", ".join("?" for _ in data_cols)
    dst_cur.execute(
        f"INSERT INTO {table} ({', '.join(data_cols)}) VALUES ({placeholders})",
        values,
    )
    new_id = dst_cur.lastrowid
    id_map[old_id] = new_id
    return new_id


def delete_existing_sailwave(dst_cur):
    sailwave_regatta_ids = [r[0] for r in rows(
        dst_cur, "SELECT id FROM regattas WHERE platform=?", (SAILWAVE,)
    )]
    if not sailwave_regatta_ids:
        dst_cur.execute("DELETE FROM source_text WHERE platform=?", (SAILWAVE,))
        return

    placeholders = ", ".join("?" for _ in sailwave_regatta_ids)
    sailwave_sailor_ids = [r[0] for r in rows(
        dst_cur,
        f"SELECT DISTINCT sailor_id FROM participation "
        f"WHERE regatta_id IN ({placeholders}) AND sailor_id IS NOT NULL",
        sailwave_regatta_ids,
    )]
    if sailwave_sailor_ids:
        sailor_placeholders = ", ".join("?" for _ in sailwave_sailor_ids)
        dst_cur.execute(
            f"DELETE FROM sailor_alias WHERE sailor_id IN ({sailor_placeholders})",
            sailwave_sailor_ids,
        )
    dst_cur.execute(
        f"DELETE FROM race_results WHERE regatta_id IN ({placeholders})",
        sailwave_regatta_ids,
    )
    dst_cur.execute(
        f"DELETE FROM participation WHERE regatta_id IN ({placeholders})",
        sailwave_regatta_ids,
    )
    dst_cur.execute(
        f"DELETE FROM regattas WHERE id IN ({placeholders})",
        sailwave_regatta_ids,
    )
    dst_cur.execute("DELETE FROM source_text WHERE platform=?", (SAILWAVE,))


def merge(local_path, dst_path):
    src = sqlite3.connect(local_path)
    dst = sqlite3.connect(dst_path)
    src.row_factory = sqlite3.Row
    dst.row_factory = sqlite3.Row
    src_cur = src.cursor()
    dst_cur = dst.cursor()

    ensure_source_text(dst_cur)
    delete_existing_sailwave(dst_cur)

    regatta_ids = [r[0] for r in rows(
        src_cur, "SELECT id FROM regattas WHERE platform=? ORDER BY id", (SAILWAVE,)
    )]
    if not regatta_ids:
        raise RuntimeError("No local Sailwave regattas found")

    placeholders = ", ".join("?" for _ in regatta_ids)
    participation = rows(
        src_cur,
        f"SELECT id, sailor_id, boat_id, regatta_id FROM participation "
        f"WHERE regatta_id IN ({placeholders}) ORDER BY id",
        regatta_ids,
    )
    race_results = rows(
        src_cur,
        f"SELECT id, boat_id, regatta_id FROM race_results "
        f"WHERE regatta_id IN ({placeholders}) ORDER BY id",
        regatta_ids,
    )

    sailor_ids = sorted({r[1] for r in participation if r[1] is not None})
    boat_ids = sorted(
        {r[2] for r in participation if r[2] is not None}
        | {r[1] for r in race_results if r[1] is not None}
    )

    sailor_map = {}
    boat_map = {}
    regatta_map = {}

    for old_id in sailor_ids:
        copy_row(src_cur, dst_cur, "sailors", old_id, sailor_map)
    for old_id in boat_ids:
        copy_row(src_cur, dst_cur, "boats", old_id, boat_map)
    for old_id in regatta_ids:
        copy_row(src_cur, dst_cur, "regattas", old_id, regatta_map)

    part_cols = [c for c in columns(src_cur, "participation") if c != "id"]
    for old_id, sailor_id, boat_id, regatta_id in participation:
        src_cur.execute(
            f"SELECT {', '.join(part_cols)} FROM participation WHERE id=?",
            (old_id,),
        )
        values = dict(zip(part_cols, src_cur.fetchone()))
        values["sailor_id"] = sailor_map.get(sailor_id)
        values["boat_id"] = boat_map.get(boat_id) if boat_id is not None else None
        values["regatta_id"] = regatta_map[regatta_id]
        dst_cur.execute(
            f"INSERT INTO participation ({', '.join(part_cols)}) "
            f"VALUES ({', '.join('?' for _ in part_cols)})",
            [values[c] for c in part_cols],
        )

    race_cols = [c for c in columns(src_cur, "race_results") if c != "id"]
    for old_id, boat_id, regatta_id in race_results:
        src_cur.execute(
            f"SELECT {', '.join(race_cols)} FROM race_results WHERE id=?",
            (old_id,),
        )
        values = dict(zip(race_cols, src_cur.fetchone()))
        values["boat_id"] = boat_map.get(boat_id) if boat_id is not None else None
        values["regatta_id"] = regatta_map[regatta_id]
        dst_cur.execute(
            f"INSERT INTO race_results ({', '.join(race_cols)}) "
            f"VALUES ({', '.join('?' for _ in race_cols)})",
            [values[c] for c in race_cols],
        )

    source_cols = [c for c in columns(src_cur, "source_text") if c != "id"]
    for row in rows(src_cur, "SELECT * FROM source_text WHERE platform=?", (SAILWAVE,)):
        values = dict(row)
        entity_type = values.get("entity_type")
        entity_id = values.get("entity_id")
        if entity_type == "regatta" and entity_id is not None:
            values["entity_id"] = regatta_map.get(entity_id)
        elif entity_type == "sailor" and entity_id is not None:
            values["entity_id"] = sailor_map.get(entity_id)
        elif entity_type == "boat" and entity_id is not None:
            values["entity_id"] = boat_map.get(entity_id)
        elif entity_type in ("participation", "race_result"):
            values["entity_id"] = None
        dst_cur.execute(
            f"INSERT INTO source_text ({', '.join(source_cols)}) "
            f"VALUES ({', '.join('?' for _ in source_cols)})",
            [values[c] for c in source_cols],
        )

    for old_sailor_id, canonical_id in rows(
        src_cur,
        f"SELECT DISTINCT a.sailor_id, a.canonical_id "
        f"FROM sailor_alias a "
        f"JOIN participation p ON p.sailor_id = a.sailor_id "
        f"WHERE p.regatta_id IN ({placeholders})",
        regatta_ids,
    ):
        new_sailor_id = sailor_map.get(old_sailor_id)
        if new_sailor_id is None:
            continue
        new_canonical_id = sailor_map.get(canonical_id, canonical_id)
        if new_sailor_id == new_canonical_id:
            continue
        dst_cur.execute("""
            INSERT INTO sailor_alias (sailor_id, canonical_id)
            VALUES (?, ?)
            ON CONFLICT(sailor_id) DO UPDATE SET canonical_id=excluded.canonical_id
        """, (new_sailor_id, new_canonical_id))

    dst_cur.execute("""
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
            SELECT sw.id AS sailor_id, MIN(other.id) AS canonical_id
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
        ON CONFLICT(sailor_id) DO UPDATE SET canonical_id=excluded.canonical_id
    """)

    dst.commit()

    summary = {
        "regattas": len(regatta_map),
        "sailors": len(sailor_map),
        "boats": len(boat_map),
        "participation": len(participation),
        "race_results": len(race_results),
        "source_text": rows(
            dst_cur,
            "SELECT count(*) FROM source_text WHERE platform=?",
            (SAILWAVE,),
        )[0][0],
        "sailor_alias": rows(
            dst_cur,
            f"SELECT count(*) FROM sailor_alias a "
            f"JOIN participation p ON p.sailor_id = a.sailor_id "
            f"JOIN regattas r ON r.id = p.regatta_id "
            f"WHERE r.platform=?",
            (SAILWAVE,),
        )[0][0],
    }
    src.close()
    dst.close()
    return summary


def main():
    if len(sys.argv) != 3:
        print(__doc__.strip())
        return 2
    summary = merge(sys.argv[1], sys.argv[2])
    for key, value in summary.items():
        print(f"{key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
