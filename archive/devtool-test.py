import httpx

EID = 16941
BASE = f"https://api.yachtscoring.com/v1/public/event/{EID}"
H = {
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://www.yachtscoring.com",
    "Referer": "https://www.yachtscoring.com/",
    "User-Agent": "Mozilla/5.0",
}

paths = ["entries", "competitors", "boats", "crew", "results",
         "scores", "divisions", "classes", "races", "registrations"]

with httpx.Client(headers=H, timeout=30) as c:
    for p in paths:
        r = c.get(f"{BASE}/{p}?size=99999")
        print(f"{r.status_code}  {len(r.content):>7}b  /{p}")