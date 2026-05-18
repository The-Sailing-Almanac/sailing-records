import httpx, re

URL = "https://www.yachtscoring.com/static/js/main.d95053f1.js"
js = httpx.get(URL, timeout=60).text
print(f"Bundle size: {len(js):,} chars\n")

# 1. Sanity check — how often do key markers appear?
print("Marker counts (verify bundle is the right one):")
for marker in ["/v1/", "/public/", "/event/", "/boats", "/races",
               "yachtscoring", "api.", "axios", "fetch"]:
    print(f"  {marker!r:20} {js.count(marker)}")

# 2. Quoted strings that LOOK like API path fragments
#    e.g. "/event/", "/boats", "scoring/cumulative"
fragments = sorted(set(re.findall(r'["\']/[a-zA-Z][a-zA-Z0-9_\-/]{2,60}["\']', js)))
print(f"\nQuoted path fragments ({len(fragments)} total). API-relevant ones:")
keywords = ['event', 'boat', 'race', 'crew', 'score', 'result', 'rank',
            'standing', 'split', 'public', 'protest', 'rc-', 'cumulative',
            'scoring', 'place', 'finish', 'series', 'entry']
relevant = [f for f in fragments if any(k in f.lower() for k in keywords)]
for f in relevant:
    print(f"  {f}")

# 3. Specific check: anything mentioning the slug from the redirect URL
print(f"\nMentions of 'cumulative': {js.count('cumulative')}")
print(f"Mentions of 'event_results': {js.count('event_results')}")
print(f"Mentions of 'event-results': {js.count('event-results')}")

# 4. If the API base is stored as a constant, find it
api_bases = re.findall(r'["\']https?://[^"\']*api[^"\']*["\']', js)
print(f"\nAPI base URL strings: {len(set(api_bases))}")
for b in sorted(set(api_bases))[:10]:
    print(f"  {b}")