import sqlite3

con = sqlite3.connect("sailing_data.db")

print("=== Table counts ===")
for table in ["regattas", "boats", "sailors", "participation", "race_results"]:
    n = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    print(f"  {table}: {n:,}")

print("\n=== Sailor match confidence breakdown ===")
for row in con.execute("""
    SELECT match_confidence, COUNT(*)
    FROM sailors
    GROUP BY match_confidence
    ORDER BY COUNT(*) DESC
"""):
    print(f"  {row[0]:12} {row[1]:,}")

print("\n=== Monts family at Charleston Race Week 2025 (eID 16941) ===")
for row in con.execute("""
    SELECT s.full_name, s.match_confidence, p.role, b.name, b.design
    FROM sailors s
    JOIN participation p ON p.sailor_id = s.id
    JOIN boats b ON b.id = p.boat_id
    WHERE p.regatta_id = 16941
      AND s.last_name = 'Monts'
    ORDER BY s.full_name
"""):
    print(f"  {row}")

print("\n=== Most-active sailors (parsed data only) ===")
for row in con.execute("""
    SELECT s.full_name, s.match_confidence, COUNT(DISTINCT p.regatta_id) AS regattas
    FROM sailors s
    JOIN participation p ON p.sailor_id = s.id
    GROUP BY s.id
    ORDER BY regattas DESC
    LIMIT 15
"""):
    print(f"  {row}")

print("\n=== Race results sample (Charleston 2025 PHRF Inshore) ===")
for row in con.execute("""
    SELECT b.name, rr.race_number, rr.finish_status, rr.race_value
    FROM race_results rr
    JOIN boats b ON b.id = rr.boat_id
    WHERE rr.regatta_id = 16941
      AND rr.class_name LIKE '%PHRF Inshore%'
    ORDER BY b.name, rr.race_number
    LIMIT 25
"""):
    print(f"  {row}")

print("\n=== Same last name on same boat (legacy candidates, top 20) ===")
for row in con.execute("""
    SELECT s.last_name, b.name AS boat_name, r.event_name,
           COUNT(DISTINCT s.id) AS sailors_with_surname,
           GROUP_CONCAT(DISTINCT s.full_name) AS names
    FROM sailors s
    JOIN participation p ON p.sailor_id = s.id
    JOIN boats b ON b.id = p.boat_id
    JOIN regattas r ON r.id = p.regatta_id
    WHERE s.last_name IS NOT NULL AND s.last_name != ''
    GROUP BY s.last_name, b.id, r.id
    HAVING sailors_with_surname >= 2
    ORDER BY sailors_with_surname DESC, s.last_name
    LIMIT 20
"""):
    print(f"  {row}")

con.close()