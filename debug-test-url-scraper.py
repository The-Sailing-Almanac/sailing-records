import httpx
import json

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

r = httpx.get(URL, headers=headers, timeout=30)
print(f"Status: {r.status_code}")
print(f"Size: {len(r.content):,} bytes")

data = r.json()
print(f"\nTop-level keys: {list(data.keys()) if isinstance(data, dict) else type(data)}")
print(f"\nFirst 2000 chars of pretty-printed JSON:")
print(json.dumps(data, indent=2)[:2000])