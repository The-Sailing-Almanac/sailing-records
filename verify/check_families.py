import sqlite3

con = sqlite3.connect("sailing_data.db")

print("=== Family count by confidence ===")
for row in con.execute("""
    SELECT confidence, COUNT(*), SUM(sailor_count)
    FROM families
    GROUP BY confidence
    ORDER BY CASE confidence WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
"""):
    print(f"  {row[0]:8} families={row[1]:>4}  total_sailors={row[2]:>5}")

print("\n=== Top families by sailor count ===")
for row in con.execute("""
    SELECT id, surname, sailor_count, regatta_count, boat_count,
           year_span, confidence, evidence
    FROM families
    ORDER BY sailor_count DESC, regatta_count DESC
    LIMIT 20
"""):
    print(f"  fam_id={row[0]:>4}  {row[1]:<15}  sailors={row[2]:>2}"
          f"  regattas={row[3]:>3}  boats={row[4]:>2}  span={row[5]}y"
          f"  conf={row[6]:<6}  evidence: {row[7]}")

print("\n=== Top families by regatta count (active legacies) ===")
for row in con.execute("""
    SELECT id, surname, sailor_count, regatta_count, year_span, confidence
    FROM families
    ORDER BY regatta_count DESC
    LIMIT 15
"""):
    print(f"  fam_id={row[0]:>4}  {row[1]:<15}  sailors={row[2]:>2}"
          f"  regattas={row[3]:>3}  span={row[4]}y  conf={row[5]}")

print("\n=== Drill: Monts family members ===")
for row in con.execute("""
    SELECT s.full_name, s.match_confidence, COUNT(DISTINCT p.regatta_id) AS reg
    FROM sailors s
    JOIN families f ON f.id = s.family_id
    LEFT JOIN participation p ON p.sailor_id = s.id
    WHERE f.surname = 'Monts'
    GROUP BY s.id
    ORDER BY reg DESC
"""):
    print(f"  {row[0]:<25}  {row[1]:<10}  {row[2]} regattas")

con.close()