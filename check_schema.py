import sqlite3

con = sqlite3.connect("sailing_data.db")
cur = con.cursor()

for table in ("regattas", "participation", "boats", "sailors"):
    print(f"\n--- {table} ---")
    cur.execute(f"PRAGMA table_info({table})")
    for row in cur.fetchall():
        print(row)

con.close()