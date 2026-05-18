def get_eids():
    """Extract integer eIDs from the harvester's registry table."""
    con = sqlite3.connect(DB_PATH)
    rows = con.execute("""
        SELECT DISTINCT
            CAST(SUBSTR(url, INSTR(url, 'eID=') + 4) AS INTEGER) AS eid
        FROM registry
        WHERE platform = 'YachtScoring'
          AND url LIKE '%eID=%'
        ORDER BY eid
    """).fetchall()
    con.close()
    return [r[0] for r in rows if r[0] > 0]