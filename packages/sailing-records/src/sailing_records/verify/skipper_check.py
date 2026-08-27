import sqlite3
con = sqlite3.connect("sailing_data.db")
cur = con.cursor()
cur.execute("SELECT role, COUNT(*) FROM participation GROUP BY role")
for row in cur.fetchall():
    print(f"  {row[0]:15s} {row[1]:>10,}")
con.close()