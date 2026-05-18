import sqlite3
import sys

FAMILY_ID = int(sys.argv[1]) if len(sys.argv) > 1 else 174

con = sqlite3.connect("sailing_data.db")

row = con.execute("""
    SELECT surname, sailor_count, regatta_count, boat_count,
           year_span, confidence, evidence
    FROM families WHERE id = ?
""", (FAMILY_ID,)).fetchone()
if not row:
    print(f"No family id {FAMILY_ID}")
    raise SystemExit

print(f"=== Family {FAMILY_ID}: {row[0]} ===")
print(f"  {row[1]} sailors, {row[2]} regattas, {row[3]} boats, "
      f"{row[4]}-year span, confidence={row[5]}")
print(f"  Evidence: {row[6]}\n")

print("=== Sailors ===")
for s in con.execute("""
    SELECT s.full_name, s.match_confidence, s.club, s.world_sailing_id,
           COUNT(DISTINCT p.regatta_id) AS regattas
    FROM sailors s
    LEFT JOIN participation p ON p.sailor_id = s.id
    WHERE s.family_id = ?
    GROUP BY s.id
    ORDER BY regattas DESC, s.full_name
""", (FAMILY_ID,)):
    print(f"  {s[0]:<30} {s[1]:<10} club={s[2] or '-':<25} "
          f"WS={s[3] or '-':<10} regattas={s[4]}")

print("\n=== Boats ===")
for b in con.execute("""
    SELECT b.name, b.design, COUNT(DISTINCT p.regatta_id) AS regattas
    FROM sailors s
    JOIN participation p ON p.sailor_id = s.id
    JOIN boats b ON b.id = p.boat_id
    WHERE s.family_id = ?
    GROUP BY b.id
    ORDER BY regattas DESC
""", (FAMILY_ID,)):
    print(f"  {b[0] or '(no name)':<30} {b[1] or '-':<25} regattas={b[2]}")

print("\n=== Year-by-year participation ===")
for y in con.execute("""
    SELECT substr(r.start_date, 1, 4) AS year,
           COUNT(DISTINCT p.regatta_id) AS regattas,
           GROUP_CONCAT(DISTINCT s.full_name) AS sailors
    FROM sailors s
    JOIN participation p ON p.sailor_id = s.id
    JOIN regattas r ON r.id = p.regatta_id
    WHERE s.family_id = ?
    GROUP BY year
    ORDER BY year
""", (FAMILY_ID,)):
    print(f"  {y[0]}: {y[1]} regattas — {y[2]}")

con.close()