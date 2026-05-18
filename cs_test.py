"""
cs_test.py
Quick proof-of-concept: query Clubspot's Parse API directly.
"""
import json
import urllib.request

BASE = "https://theclubspot.com/parse/classes"
APP_ID = "myclubspot2017"
CLIENT_VERSION = "js4.3.1-forked-1.2.0"

def parse_post(classname, payload):
    url = f"{BASE}/{classname}"
    payload["_ApplicationId"] = APP_ID
    payload["_ClientVersion"] = CLIENT_VERSION
    payload["_method"] = "GET"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (sailing-legacy-research)",
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))

# Test 1: fetch the RCYC J/22 regatta we know exists
print("--- Test 1: fetch known regatta ---")
result = parse_post("regattas", {
    "where": {"objectId": "D2xZb91v46"},
    "limit": 1
})
print(json.dumps(result, indent=2)[:2000])

# Test 2: fetch all regattas (no filter) — see if it works and what limit applies
print("\n--- Test 2: fetch regattas no filter, limit 5 ---")
result = parse_post("regattas", {
    "where": {},
    "limit": 5,
    "order": "-createdAt"
})
print(json.dumps(result, indent=2)[:2000])

# Test 3: count total regattas
print("\n--- Test 3: count total regattas ---")
result = parse_post("regattas", {
    "where": {},
    "limit": 0,
    "count": 1
})
print(json.dumps(result, indent=2))