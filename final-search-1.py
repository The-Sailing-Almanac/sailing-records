import httpx, re

URL = "https://www.yachtscoring.com/static/js/main.d95053f1.js"
js = httpx.get(URL, timeout=60).text
print(f"Bundle size: {len(js):,} chars\n")

# every /v1/public/... path mentioned in the source
paths = sorted(set(re.findall(r"/v1/public/[a-zA-Z0-9_/\-{}.:?$&=]+", js)))
print(f"Found {len(paths)} unique /v1/public/ paths:\n")
for p in paths:
    print(f"  {p}")

# also catch any other /v1/ paths (private/admin endpoints we'd skip,
# but useful to see the shape of the API)
other = sorted(set(re.findall(r"/v1/(?!public)[a-zA-Z0-9_/\-{}.:?$&=]+", js)))
if other:
    print(f"\nOther /v1/ paths ({len(other)}):")
    for p in other[:20]:
        print(f"  {p}")