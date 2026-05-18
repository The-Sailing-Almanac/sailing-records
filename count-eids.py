import sqlite3

con = sqlite3.connect("sailing_urls.db")
rows = con.execute("""
    SELECT DISTINCT
        CAST(SUBSTR(url, INSTR(url, 'eID=') + 4) AS INTEGER) AS eid
    FROM registry
    WHERE platform = 'YachtScoring'
      AND url LIKE '%eID=%'
    ORDER BY eid
""").fetchall()
print(f"get_eids() would return {len(rows):,} eIDs")
if rows:
    print(f"First 5: {[r[0] for r in rows[:5]]}")
    print(f"Last 5:  {[r[0] for r in rows[-5:]]}")
con.close()