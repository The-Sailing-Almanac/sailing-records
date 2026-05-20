from pathlib import Path

# check a few likely spots
for folder in [
    Path.cwd(),
    Path.home() / "Downloads",
    Path("C:/Users/aewoo/Downloads"),
]:
    if folder.exists():
        db_files = list(folder.glob("*.db")) + list(folder.glob("*.sqlite*"))
        if db_files:
            print(f"\n{folder}:")
            for f in db_files:
                size_mb = f.stat().st_size / 1024 / 1024
                print(f"  {f.name}  ({size_mb:.2f} MB)")