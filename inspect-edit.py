from pathlib import Path

raw = Path("raw")
print(f"raw/ exists: {raw.exists()}")

if raw.exists():
    for folder in sorted(raw.iterdir()):
        print(f"\n{folder.name}/")
        for f in sorted(folder.iterdir()):
            size = f.stat().st_size
            print(f"  {f.name}  ({size:,} bytes)")
            # If it's small, peek at contents — might be an error message
            if size < 500 and f.suffix == ".json":
                print(f"    content: {f.read_text(encoding='utf-8')[:200]}")