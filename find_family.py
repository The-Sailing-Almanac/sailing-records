import sqlite3, sys

surname = sys.argv[1] if len(sys.argv) > 1 else "Reid"

con = sqlite3.connect("sailing_data.db")
rows = list(con.execute("""
    SELECT id, surname, sailor_count, regatta_count, boat_count,
           year_span, confidence
    FROM families WHERE LOWER(surname) = LOWER(?)
    ORDER BY sailor_count DESC
""", (surname,)))

if not rows:
    print(f"No families found with surname '{surname}'")
else:
    print(f"Families matching '{surname}':")
    for row in rows:
        print(f"  fam_id={row[0]}  {row[1]}  sailors={row[2]} regattas={row[3]}"
              f"  boats={row[4]}  span={row[5]}y  conf={row[6]}")
con.close()