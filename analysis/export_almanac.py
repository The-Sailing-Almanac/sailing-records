"""
export_almanac.py

Builds a portable JSONL knowledge-block export for the sailing-almanac repo.
The export is derived from sailing_data.db and is intentionally read-only:
almanac consumers should treat these files as evidence/provenance inputs, not
as the operational harvesting database.
"""
import argparse
import hashlib
import json
import re
import sqlite3
import time
from pathlib import Path

DB_PATH = "sailing_data.db"
OUT_DIR = Path("exports/almanac")


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def stable_id(prefix, *parts):
    raw = "|".join("" if part is None else str(part) for part in parts)
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]
    return f"{prefix}_{digest}"


def normalize_text(value):
    value = (value or "").lower().strip()
    value = re.sub(r"[^\w\s]", " ", value, flags=re.UNICODE)
    return re.sub(r"\s+", " ", value).strip()


def write_jsonl(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with path.open("w", encoding="utf-8", newline="\n") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
            count += 1
    return count


def dict_rows(cur, sql, params=()):
    cur.execute(sql, params)
    cols = [desc[0] for desc in cur.description]
    for row in cur.fetchall():
        yield dict(zip(cols, row))


def table_exists(cur, table):
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    return cur.fetchone() is not None


def export_clubs(cur, out_dir):
    sql = """
        SELECT
            club AS club_name,
            club_normalized,
            city,
            state AS state_region,
            country,
            count(*) AS sailor_record_count
        FROM sailors
        WHERE club IS NOT NULL AND trim(club) != ''
        GROUP BY club_normalized, club, city, state, country
        ORDER BY lower(club), country
    """
    def rows():
        for row in dict_rows(cur, sql):
            club_norm = row["club_normalized"] or normalize_text(row["club_name"])
            yield {
                "club_id": stable_id("club", club_norm, row["country"]),
                "club_name": row["club_name"],
                "club_name_normalized": club_norm,
                "city": row["city"],
                "state_region": row["state_region"],
                "country": row["country"],
                "source": "derived_from_sailors.club",
                "sailor_record_count": row["sailor_record_count"],
                "verified_status": "derived",
            }
    return write_jsonl(out_dir / "clubs.jsonl", rows())


def export_regattas(cur, out_dir):
    sql = """
        SELECT
            id, event_name, start_date, end_date, city, state, country, platform,
            is_completed, raw_event_url, parsed_at, cs_regatta_id, rn_regatta_id
        FROM regattas
        ORDER BY start_date, event_name, id
    """
    def rows():
        for row in dict_rows(cur, sql):
            row["regatta_id"] = f"regatta_{row.pop('id')}"
            row["source_url"] = row.pop("raw_event_url")
            yield row
    return write_jsonl(out_dir / "regattas.jsonl", rows())


def export_boats(cur, out_dir):
    sql = """
        SELECT
            id, yacht_scoring_boat_id, name, design, length, first_seen_event_id,
            cs_sail_number, rn_sail_number, parsed_at
        FROM boats
        ORDER BY lower(name), id
    """
    def rows():
        for row in dict_rows(cur, sql):
            row["boat_id"] = f"boat_{row.pop('id')}"
            if row["first_seen_event_id"] is not None:
                row["first_seen_regatta_id"] = f"regatta_{row.pop('first_seen_event_id')}"
            else:
                row.pop("first_seen_event_id")
                row["first_seen_regatta_id"] = None
            yield row
    return write_jsonl(out_dir / "boats.jsonl", rows())


def export_sailors(cur, out_dir):
    sql = """
        SELECT
            id, full_name, first_name, last_name, world_sailing_id,
            us_sailing_id, club, club_normalized, city, state, country,
            match_confidence, name_normalized, family_id, slug, parsed_at
        FROM sailors
        ORDER BY lower(full_name), id
    """
    def rows():
        for row in dict_rows(cur, sql):
            row["sailor_id"] = f"sailor_{row.pop('id')}"
            if row["family_id"] is not None:
                row["family_id"] = f"family_{row['family_id']}"
            yield row
    return write_jsonl(out_dir / "sailors.jsonl", rows())


def export_sources(cur, out_dir):
    if not table_exists(cur, "source_text"):
        return write_jsonl(out_dir / "sources.jsonl", iter(()))
    sql = """
        SELECT
            id, entity_type, entity_id, platform, source_url, source_language,
            field_name, source_text, source_context, parsed_at
        FROM source_text
        ORDER BY platform, source_url, id
    """
    def rows():
        for row in dict_rows(cur, sql):
            row["source_text_id"] = f"source_text_{row.pop('id')}"
            yield row
    return write_jsonl(out_dir / "sources.jsonl", rows())


def export_result_entries(cur, out_dir):
    sql = """
        WITH race_totals AS (
            SELECT
                rr.regatta_id,
                rr.boat_id,
                rr.class_name,
                rr.division_name,
                count(*) AS race_count,
                sum(COALESCE(rr.race_value, rr.sort_value, 0)) AS total_score
            FROM race_results rr
            WHERE rr.boat_id IS NOT NULL
            GROUP BY rr.regatta_id, rr.boat_id, rr.class_name, rr.division_name
        ),
        participant_names AS (
            SELECT
                p.regatta_id,
                p.boat_id,
                group_concat(DISTINCT s.full_name) AS sailor_names,
                group_concat(DISTINCT p.role) AS roles
            FROM participation p
            LEFT JOIN sailors s ON s.id = p.sailor_id
            WHERE p.boat_id IS NOT NULL
            GROUP BY p.regatta_id, p.boat_id
        )
        SELECT
            rt.regatta_id,
            r.event_name,
            r.start_date,
            r.country,
            r.platform,
            r.raw_event_url,
            rt.boat_id,
            b.name AS boat_name,
            b.design AS boat_design,
            rt.class_name,
            rt.division_name,
            rt.race_count,
            rt.total_score,
            pn.sailor_names,
            pn.roles
        FROM race_totals rt
        JOIN regattas r ON r.id = rt.regatta_id
        LEFT JOIN boats b ON b.id = rt.boat_id
        LEFT JOIN participant_names pn
          ON pn.regatta_id = rt.regatta_id AND pn.boat_id = rt.boat_id
        ORDER BY r.start_date, r.event_name, rt.class_name, rt.total_score
    """
    def rows():
        for row in dict_rows(cur, sql):
            row["result_entry_id"] = stable_id(
                "result_entry",
                row["regatta_id"],
                row["boat_id"],
                row["class_name"],
                row["division_name"],
            )
            row["regatta_id"] = f"regatta_{row['regatta_id']}"
            row["boat_id"] = f"boat_{row['boat_id']}"
            row["source_url"] = row.pop("raw_event_url")
            yield row
    return write_jsonl(out_dir / "result_entries.jsonl", rows())


def export_annual_award_candidates(cur, out_dir):
    sql = """
        WITH race_totals AS (
            SELECT
                rr.regatta_id,
                rr.boat_id,
                COALESCE(rr.class_name, '') AS class_name,
                COALESCE(rr.division_name, '') AS division_name,
                count(*) AS race_count,
                sum(COALESCE(rr.race_value, rr.sort_value, 0)) AS total_score
            FROM race_results rr
            WHERE rr.boat_id IS NOT NULL
            GROUP BY rr.regatta_id, rr.boat_id, COALESCE(rr.class_name, ''), COALESCE(rr.division_name, '')
        ),
        ranked AS (
            SELECT
                rt.*,
                rank() OVER (
                    PARTITION BY rt.regatta_id, rt.class_name, rt.division_name
                    ORDER BY rt.total_score ASC, rt.boat_id ASC
                ) AS candidate_rank
            FROM race_totals rt
        ),
        participant_names AS (
            SELECT
                p.regatta_id,
                p.boat_id,
                group_concat(DISTINCT s.full_name) AS sailor_names,
                group_concat(DISTINCT s.club) AS sailor_clubs
            FROM participation p
            LEFT JOIN sailors s ON s.id = p.sailor_id
            WHERE p.boat_id IS NOT NULL
            GROUP BY p.regatta_id, p.boat_id
        )
        SELECT
            ranked.regatta_id,
            r.event_name,
            substr(COALESCE(r.start_date, r.end_date, ''), 1, 4) AS award_year,
            r.country,
            r.platform,
            r.raw_event_url,
            ranked.boat_id,
            b.name AS boat_name,
            b.design AS boat_design,
            ranked.class_name,
            ranked.division_name,
            ranked.race_count,
            ranked.total_score,
            ranked.candidate_rank,
            pn.sailor_names,
            pn.sailor_clubs
        FROM ranked
        JOIN regattas r ON r.id = ranked.regatta_id
        LEFT JOIN boats b ON b.id = ranked.boat_id
        LEFT JOIN participant_names pn
          ON pn.regatta_id = ranked.regatta_id AND pn.boat_id = ranked.boat_id
        WHERE ranked.candidate_rank = 1
        ORDER BY award_year, r.event_name, ranked.class_name, ranked.division_name
    """
    def rows():
        for row in dict_rows(cur, sql):
            row["candidate_award_id"] = stable_id(
                "candidate_award",
                row["regatta_id"],
                row["boat_id"],
                row["class_name"],
                row["division_name"],
            )
            row["regatta_id"] = f"regatta_{row['regatta_id']}"
            row["boat_id"] = f"boat_{row['boat_id']}"
            row["source_url"] = row.pop("raw_event_url")
            row["confidence"] = "derived_race_total"
            row["review_status"] = "candidate"
            row["notes"] = (
                "Derived from lowest aggregate race score inside regatta/class/division; "
                "must be reviewed before treating as an official trophy award."
            )
            yield row
    return write_jsonl(out_dir / "annual_award_candidates.jsonl", rows())


def export_empty_almanac_tables(out_dir):
    counts = {}
    for name in ("trophies", "trophy_awards", "trophy_media"):
        counts[name] = write_jsonl(out_dir / f"{name}.jsonl", iter(()))
    return counts


def write_manifest(out_dir, counts, db_path):
    manifest = {
        "export_name": "sailing-almanac-knowledge-block",
        "generated_at": now_iso(),
        "source_database": str(db_path),
        "format": "jsonl",
        "counts": counts,
        "notes": [
            "This bundle is derived from sailing-records and is intended for read-only use by sailing-almanac.",
            "annual_award_candidates are inferred from scoring totals and require review before publication.",
            "trophy files are placeholders until curated club trophy intake is loaded.",
        ],
    }
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False, sort_keys=True),
        encoding="utf-8",
    )


def main():
    parser = argparse.ArgumentParser(description="Export sailing-almanac JSONL knowledge blocks.")
    parser.add_argument("--db", default=DB_PATH, help="Path to sailing_data.db")
    parser.add_argument("--out", default=str(OUT_DIR), help="Output directory")
    args = parser.parse_args()

    db_path = Path(args.db)
    out_dir = Path(args.out)
    if not db_path.exists():
        raise SystemExit(f"Database not found: {db_path}")

    con = sqlite3.connect(db_path)
    cur = con.cursor()
    counts = {
        "clubs": export_clubs(cur, out_dir),
        "regattas": export_regattas(cur, out_dir),
        "boats": export_boats(cur, out_dir),
        "sailors": export_sailors(cur, out_dir),
        "sources": export_sources(cur, out_dir),
        "result_entries": export_result_entries(cur, out_dir),
        "annual_award_candidates": export_annual_award_candidates(cur, out_dir),
    }
    counts.update(export_empty_almanac_tables(out_dir))
    con.close()

    write_manifest(out_dir, counts, db_path)
    for name, count in counts.items():
        print(f"{name}: {count}")
    print(f"manifest: {out_dir / 'manifest.json'}")


if __name__ == "__main__":
    main()
