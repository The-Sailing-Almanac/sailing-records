import sqlite3

DB_PATH = "harvest.db"  # adjust if your DB file is named differently

con = sqlite3.connect(DB_PATH)

# 1. List all tables
print("=== Tables ===")
tables = con.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
).fetchall()
for (name,) in tables:
    count = con.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
    print(f"  {name}  ({count:,} rows)")

# 2. For each table, show columns and a sample row
print("\n=== Schemas + sample rows ===")
for (name,) in tables:
    cols = con.execute(f"PRAGMA table_info({name})").fetchall()
    col_names = [c[1] for c in cols]
    print(f"\n{name}: {col_names}")
    sample = con.execute(f"SELECT * FROM {name} LIMIT 1").fetchone()
    if sample:
        for col, val in zip(col_names, sample):
            v = str(val)
            if len(v) > 80:
                v = v[:77] + "..."
            print(f"    {col}: {v}")

con.close()