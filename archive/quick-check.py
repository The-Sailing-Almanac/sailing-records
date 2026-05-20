import sqlite3

con = sqlite3.connect("sailing_data.db")
cur = con.cursor()

print("--- boats columns ---")
cur.execute("PRAGMA table_info(boats)")
for row in cur.fetchall():
    print(row)

print("\n--- boats indexes ---")
cur.execute("PRAGMA index_list(boats)")
for row in cur.fetchall():
    print(row)

con.close()