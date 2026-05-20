import httpx, json

EID = 16941
URL = f"https://api.yachtscoring.com/v1/public/event/{EID}"
headers = {
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://www.yachtscoring.com",
    "Referer": "https://www.yachtscoring.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/146.0.0.0 Safari/537.36",
}

data = httpx.get(URL, headers=headers, timeout=30).json()
entries = data.get("eventEntries", [])

print(f"eventEntries type: {type(entries).__name__}")
print(f"eventEntries length: {len(entries) if hasattr(entries, '__len__') else 'n/a'}")

if isinstance(entries, list) and entries:
    print(f"\nFirst entry keys: {list(entries[0].keys())}")
    print(f"\nFirst entry pretty-printed:")
    print(json.dumps(entries[0], indent=2)[:3000])