import httpx
H = {"Accept": "application/json, text/plain, */*",
     "Origin": "https://www.yachtscoring.com",
     "Referer": "https://www.yachtscoring.com/",
     "User-Agent": "Mozilla/5.0"}
RACE_ID = 301128
EID = 16941
candidates = [
    f"https://api.yachtscoring.com/v1/public/race/{RACE_ID}/scores",
    f"https://api.yachtscoring.com/v1/public/race/{RACE_ID}/results",
    f"https://api.yachtscoring.com/v1/public/race/{RACE_ID}",
    f"https://api.yachtscoring.com/v1/public/event/{EID}/scores?size=99999",
    f"https://api.yachtscoring.com/v1/public/event/{EID}/standings?size=99999",
    f"https://api.yachtscoring.com/v1/public/event/{EID}/cumulative?size=99999",
    f"https://api.yachtscoring.com/v1/public/event/{EID}/results-cumulative?size=99999",
]
with httpx.Client(headers=H, timeout=30) as c:
    for url in candidates:
        r = c.get(url)
        print(f"{r.status_code}  {len(r.content):>7}b  {url}")