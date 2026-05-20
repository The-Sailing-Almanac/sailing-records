from pathlib import Path
import re

RAW_DIR = Path("raw_rn")

def show_regatta(fid):
    f = RAW_DIR / str(fid) / "results.html"
    if not f.exists():
        print(f"  {fid}: no file")
        return
    text = f.read_text(encoding="iso-8859-1", errors="replace")

    print(f"\n{'='*70}")
    print(f"REGATTA {fid}")
    print(f"{'='*70}")

    # h4 block for name/date/club
    h4 = re.search(r"<h4>(.*?)</h4>", text, re.DOTALL)
    if h4:
        print("H4:", h4.group(1).replace("\n"," ").strip()[:300])

    # All h2 blocks = fleet names
    for h2 in re.finditer(r"<h2>(.*?)</h2>", text, re.DOTALL):
        print("H2:", h2.group(1).replace("\n"," ").strip()[:200])

    # All thead blocks = column headers
    for i, thead in enumerate(re.finditer(r"<thead>(.*?)</thead>", text, re.DOTALL)):
        cells = re.findall(r"<b>(.*?)</b>", thead.group(1), re.DOTALL)
        cleaned = [c.replace("\n","").strip() for c in cells if c.strip()]
        print(f"  THEAD[{i}]: {cleaned}")
        if i >= 2:
            break

    # First tbody = first fleet's rows
    tbody = re.search(r"<tbody[^>]*>(.*?)</tbody>", text, re.DOTALL)
    if tbody:
        # Extract all td text content
        rows = re.findall(r"<tr>(.*?)</tr>", tbody.group(1), re.DOTALL)
        for j, row in enumerate(rows[:5]):
            cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.DOTALL)
            cleaned = []
            for c in cells:
                # strip tags, get text
                t = re.sub(r"<[^>]+>", "", c).strip()
                t = re.sub(r"\s+", " ", t).strip()
                if t:
                    cleaned.append(t)
            print(f"  ROW[{j}]: {cleaned}")

# Show 3 different regattas
for fid in [8, 17824, 31426]:
    show_regatta(fid)