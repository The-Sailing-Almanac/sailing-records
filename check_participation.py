import sqlite3
con = sqlite3.connect("sailing_data.db")
cur = con.cursor()

print("--- Participation by role ---")
cur.execute("SELECT role, COUNT(*) FROM participation GROUP BY role")
for row in cur.fetchall():
    print(f"  {row[0]:15s} {row[1]:>10,}")

print("\n--- Clubspot participation rows ---")
cur.execute("SELECT COUNT(*) FROM participation WHERE cs_class_name IS NOT NULL")
print(f"  With cs_class_name: {cur.fetchone()[0]:,}")

print("\n--- Regattas by platform ---")
cur.execute("SELECT platform, COUNT(*) FROM regattas GROUP BY platform")
for row in cur.fetchall():
    print(f"  {row[0]:15s} {row[1]:>10,}")

print("\n--- CHECK constraint on participation ---")
cur.execute("SELECT sql FROM sqlite_master WHERE name='participation'")
print(cur.fetchone()[0])

con.close()