"""
cs_regatta_type_check.py

Check if the J/22 Circuit regatta we know about (D2xZb91v46) 
actually has registrations and what fields they have.
"""
import json
import urllib.request

BASE    = "https://theclubspot.com/parse/classes"
APP_ID  = "myclubspot2017"
CLIENT  = "js4.3.1-forked-1.2.0"

def parse_post(classname, payload):
    url  = f"{BASE}/{classname}"
    payload["_ApplicationId"] = APP_ID
    payload["_ClientVersion"] = CLIENT
    payload["_method"]        = "GET"
    data = json.dumps(payload).encode("utf-8")
    req  = urllib.request.Request(
        url, data=data,
        headers={
            "Content-Type": "application/json",
            "User-Agent":   "Mozilla/5.0 (sailing-legacy-research)",
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))

# Get the J/22 regatta details
regatta = parse_post("regattas", {
    "where": {"objectId": "D2xZb91v46"},
    "limit": 1
})
print("=== REGATTA: D2xZb91v46 ===")
r = regatta.get("results", [{}])[0]
print(f"Name: {r.get('name')}")
print(f"Type: camp={bool(r.get('campObject'))}, regatta={bool(r.get('regattaObject'))}")
print(f"Has registrations field: {r.get('registrations', 'MISSING')}")

# Try to fetch registrations with regattaObject pointer
print("\n=== QUERY: registrations with regattaObject pointer ===")
result = parse_post("registrations", {
    "where": {
        "regattaObject": {
            "__type": "Pointer",
            "className": "regattas",
            "objectId": "D2xZb91v46",
        },
    },
    "limit": 0,
    "count": 1
})
print(f"Found {result.get('count', 0)} registrations")

# Show a sample if any exist
if result.get('count', 0) > 0:
    result2 = parse_post("registrations", {
        "where": {
            "regattaObject": {
                "__type": "Pointer",
                "className": "regattas",
                "objectId": "D2xZb91v46",
            },
        },
        "limit": 1
    })
    if result2.get("results"):
        print("\nSample registration:")
        print(json.dumps(result2["results"][0], indent=2, default=str))