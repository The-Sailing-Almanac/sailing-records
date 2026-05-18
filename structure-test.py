import httpx, json

EID = 16941
BASE = f"https://api.yachtscoring.com/v1/public/event/{EID}"
H = {
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://www.yachtscoring.com",
    "Referer": "https://www.yachtscoring.com/",
    "User-Agent": "Mozilla/5.0",
}

with httpx.Client(headers=H, timeout=30) as c:
    boats = c.get(f"{BASE}/boats?size=99999").json()
    races = c.get(f"{BASE}/races?size=99999").json()

print("=" * 60)
print(f"BOATS — count={boats.get('count')}, rows length={len(boats.get('rows', []))}")
print("=" * 60)
rows = boats.get("rows", [])
if rows:
    print(f"\nFirst boat keys ({len(rows[0])} total):")
    print(list(rows[0].keys()))
    print(f"\nFirst boat (full):")
    print(json.dumps(rows[0], indent=2)[:5000])

print("\n" + "=" * 60)
print(f"RACES — count={races.get('count')}, rows length={len(races.get('rows', []))}")
print("=" * 60)
rrows = races.get("rows", [])
if rrows:
    print(f"\nFirst race keys ({len(rrows[0])} total):")
    print(list(rrows[0].keys()))
    print(f"\nFirst race (truncated):")
    print(json.dumps(rrows[0], indent=2)[:2000])