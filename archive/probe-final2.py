import httpx

EID = 16941
BASE = "https://api.yachtscoring.com/v1/public"
H = {
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://www.yachtscoring.com",
    "Referer": "https://www.yachtscoring.com/",
    "User-Agent": "Mozilla/5.0",
}

candidates = [
    f"{BASE}/event/{EID}/virtual-races?size=99999",
    f"{BASE}/virtual-races?eventId={EID}&size=99999",
    f"{BASE}/event/{EID}/event-boat-crews?size=99999",
    f"{BASE}/event-boat-crews?eventId={EID}&size=99999",
    f"{BASE}/event/{EID}/splits?size=99999",
    f"{BASE}/splits?eventId={EID}&size=99999",
    f"{BASE}/event-boats?eventId={EID}&size=99999",
    f"{BASE}/event/{EID}/event-history?size=99999",
    f"{BASE}/event/{EID}/rc-dockings-paginated?size=99999",
]

with httpx.Client(headers=H, timeout=30) as c:
    for url in candidates:
        try:
            r = c.get(url)
            label = url.replace(BASE, "")
            print(f"  {r.status_code}  {len(r.content):>8}b  {label}")
        except Exception as e:
            print(f"  ERR  {url}  {e}")