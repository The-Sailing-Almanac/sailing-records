"""
Almanac Trophy & Regatta Database Bridge (layline-scoring)
Connects scoring outputs directly to the SQLite schema in
packages/sailing-records/src/sailing_records/schema/almanac_trophy_schema.sql
and establishes publishing entity tables for clubs, sailors, and daily link digests.
"""
import sqlite3
from pathlib import Path
from typing import List, Dict, Any, Optional

DEFAULT_SCHEMA_PATH = (
    Path(__file__).resolve().parents[4]
    / "packages"
    / "sailing-records"
    / "src"
    / "sailing_records"
    / "schema"
    / "almanac_trophy_schema.sql"
)

def init_trophy_db(db_path: str = ":memory:", schema_path: Optional[Path] = None) -> sqlite3.Connection:
    """Initializes an SQLite connection and executes the almanac schema."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    target_schema = schema_path or DEFAULT_SCHEMA_PATH
    if target_schema.exists():
        conn.executescript(target_schema.read_text(encoding="utf-8"))

    # Add core tables if not present in legacy SQL
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS regattas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            year INTEGER NOT NULL,
            venue TEXT
        );
        CREATE TABLE IF NOT EXISTS race_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            regatta_id INTEGER REFERENCES regattas(id),
            race_number INTEGER NOT NULL,
            sail_number TEXT NOT NULL,
            boat_name TEXT,
            skipper TEXT,
            rating REAL,
            elapsed_seconds REAL,
            corrected_seconds REAL,
            points REAL NOT NULL,
            rank INTEGER
        );
        -- Publishing & Almanac Entity Pages
        CREATE TABLE IF NOT EXISTS yacht_clubs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            burgee_asset TEXT,
            city TEXT,
            state TEXT,
            est_year INTEGER,
            website TEXT
        );
        CREATE TABLE IF NOT EXISTS sailor_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            hometown TEXT,
            bio TEXT,
            avatar_asset TEXT
        );
        CREATE TABLE IF NOT EXISTS daily_newsletter_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            published_date TEXT NOT NULL,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            domain TEXT,
            category TEXT,
            description TEXT
        );
    """)
    return conn

def record_race_results(
    conn: sqlite3.Connection,
    regatta_name: str,
    year: int,
    race_number: int,
    results: List[Dict[str, Any]]
) -> int:
    """Persists a list of scored race finishes into the almanac database."""
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO regattas (name, year) VALUES (?, ?)",
        (regatta_name, year)
    )
    regatta_id = cur.lastrowid

    for r in results:
        cur.execute(
            """
            INSERT INTO race_results (
                regatta_id, race_number, sail_number, boat_name, skipper,
                rating, elapsed_seconds, corrected_seconds, points, rank
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                regatta_id,
                race_number,
                r.get("sail_number", ""),
                r.get("boat_name", ""),
                r.get("skipper", ""),
                r.get("rating"),
                r.get("elapsed_seconds"),
                r.get("corrected_seconds"),
                r.get("points", 0.0),
                r.get("rank")
            )
        )
    conn.commit()
    return regatta_id
