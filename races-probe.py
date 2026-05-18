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
    # 1) See what the empty virtual-races response actually says
    print("=== /event/{id}/virtual-races full response ===")
    r = c.get(f"{BASE}/event/{EID}/virtual-races?size=99999")
    print(json.dumps(r.json(), indent=2))

    # 2) Splits gives us splitIds — try fetching virtual-races scoped to a split
    print("\n=== /event/{id}/splits — first split ===")
    splits = c.get(f"{BASE}/event/{EID}/splits?size=99999").json()
    rows = splits.get("rows", [])
    if rows:
        first_split = rows[0]
        print(f"First split keys: {list(first_split.keys())}")
        print(json.dumps(first_split, indent=2)[:1000])
        split_id = first_split.get("id")
        print(f"\n=== Probing split-scoped scoring for splitId={split_id} ===")
        for path in [
            f"/event/{EID}/split/{split_id}/virtual-races?size=99999",
            f"/event/{EID}/split/{split_id}/results?size=99999",
            f"/event/{EID}/split/{split_id}/scores?size=99999",
            f"/split/{split_id}/virtual-races?size=99999",
            f"/split/{split_id}/results?size=99999",
            f"/virtual-races?splitId={split_id}&size=99999",
        ]:
            r = c.get(BASE + path)
            print(f"  {r.status_code}  {len(r.content):>7}b  {path}")

    # 3) Pick one boatId and probe per-boat scoring
    print("\n=== Probing per-boat scoring (boatId 312939 = Smile and Wave) ===")
    for path in [
        "/event/16941/boat/312939",
        "/event/16941/boat/312939/results",
        "/event/16941/boat/312939/scores",
        "/event/16941/boat/312939/virtual-races",
        "/boat/312939/results",
        "/boatdetail/16941/312939",
    ]:
        r = c.get(BASE + path)
        print(f"  {r.status_code}  {len(r.content):>7}b  {path}")