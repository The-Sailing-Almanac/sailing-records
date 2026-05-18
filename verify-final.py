import httpx, json

EID = 16941
BASE = "https://api.yachtscoring.com/v1/public"
H = {
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://www.yachtscoring.com",
    "Referer": "https://www.yachtscoring.com/",
    "User-Agent": "Mozilla/5.0",
}

with httpx.Client(headers=H, timeout=30) as c:
    print("=== /event/16941/cumulative-result ===")
    r = c.get(f"{BASE}/event/{EID}/cumulative-result")
    print(f"Status: {r.status_code}, Size: {len(r.content):,} bytes")
    data = r.json()
    print(f"Top-level type: {type(data).__name__}")
    if isinstance(data, dict):
        print(f"Top-level keys: {list(data.keys())}")
        print(f"\nFirst 4000 chars:")
        print(json.dumps(data, indent=2)[:4000])
    elif isinstance(data, list):
        print(f"List length: {len(data)}")
        if data:
            print(f"\nFirst element keys: {list(data[0].keys()) if isinstance(data[0], dict) else type(data[0])}")
            print(f"\nFirst element:")
            print(json.dumps(data[0], indent=2)[:3000])

    print("\n\n=== /event/16941/cumulative-result?requireSubclass=true (size only) ===")
    r2 = c.get(f"{BASE}/event/{EID}/cumulative-result?requireSubclass=true")
    print(f"Status: {r2.status_code}, Size: {len(r2.content):,} bytes")
    print(f"Same as plain version? {r.content == r2.content}")