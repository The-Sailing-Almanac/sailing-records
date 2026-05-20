#!/usr/bin/env python3
"""
sync_data.py
Sync sailing-records data between local and chantecler-01.

Uses rsync when available (Linux/Mac/WSL), falls back to scp on Windows.
Run from project root.

Usage:
    python ops/sync_data.py push   # local -> server (after harvesting/parsing)
    python ops/sync_data.py pull   # server -> local (before starting work)
"""

import subprocess
import shutil
import sys
from pathlib import Path

REMOTE_HOST = "chantecler-01"
REMOTE_PATH = "~/sailing-records"

# Files and directories to sync
DB_FILES = ["sailing_data.db", "sailing_urls.db"]
RAW_DIRS = ["raw", "raw_icsa", "raw_rn"]

HAS_RSYNC = shutil.which("rsync") is not None


def run(cmd, **kwargs):
    print(f"  $ {' '.join(str(c) for c in cmd)}")
    result = subprocess.run(cmd, **kwargs)
    if result.returncode != 0:
        print(f"  ERROR: command exited {result.returncode}")
        sys.exit(result.returncode)


def push():
    """Push local data to the authoritative copy on the server."""
    print(f"\nPushing data to {REMOTE_HOST}:{REMOTE_PATH}...\n")

    if HAS_RSYNC:
        for f in DB_FILES:
            if Path(f).exists():
                run(["rsync", "-avz", "--progress", f, f"{REMOTE_HOST}:{REMOTE_PATH}/"])
        for d in RAW_DIRS:
            if Path(d).exists():
                run(["rsync", "-avz", "--progress", f"{d}/", f"{REMOTE_HOST}:{REMOTE_PATH}/{d}/"])
    else:
        # scp fallback (Windows without rsync)
        for f in DB_FILES:
            if Path(f).exists():
                run(["scp", f, f"{REMOTE_HOST}:{REMOTE_PATH}/"])
        for d in RAW_DIRS:
            if Path(d).exists():
                run(["scp", "-r", d, f"{REMOTE_HOST}:{REMOTE_PATH}/"])

    print("\nDone. Server is up to date.")


def pull():
    """Pull authoritative data from the server to local."""
    print(f"\nPulling data from {REMOTE_HOST}:{REMOTE_PATH}...\n")

    if HAS_RSYNC:
        for f in DB_FILES:
            run(["rsync", "-avz", "--progress", f"{REMOTE_HOST}:{REMOTE_PATH}/{f}", "."])
        for d in RAW_DIRS:
            Path(d).mkdir(exist_ok=True)
            run(["rsync", "-avz", "--progress", f"{REMOTE_HOST}:{REMOTE_PATH}/{d}/", f"{d}/"])
    else:
        # scp fallback (Windows without rsync)
        for f in DB_FILES:
            run(["scp", f"{REMOTE_HOST}:{REMOTE_PATH}/{f}", "."])
        for d in RAW_DIRS:
            Path(d).mkdir(exist_ok=True)
            run(["scp", "-r", f"{REMOTE_HOST}:{REMOTE_PATH}/{d}", "."])

    print("\nDone. Local copy is up to date.")


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("push", "pull"):
        print(__doc__)
        sys.exit(1)

    mode = sys.argv[1]
    backend = "rsync" if HAS_RSYNC else "scp"
    print(f"[sync_data.py] mode={mode}  backend={backend}")

    if mode == "push":
        push()
    else:
        pull()
