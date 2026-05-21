#!/usr/bin/env python3
"""
sync_data.py
Sync sailing-records data between local and chantecler-01.

chantecler-01 is the authoritative copy. Pull before working, push after.

Usage:
    python ops/sync_data.py push   # local -> server (after harvesting/parsing)
    python ops/sync_data.py pull   # server -> local (before starting work)

Requires: ssh access to chantecler-01 (configured in ~/.ssh/config)
          rsync OR tar+ssh (tar is used automatically on Windows)
Run from project root.
"""

import subprocess
import shutil
import sys
from pathlib import Path

REMOTE_HOST  = "chantecler-01"
REMOTE_PATH  = "~/sailing-records"

DB_FILES = ["sailing_data.db", "sailing_urls.db"]
RAW_DIRS = ["raw", "raw_icsa", "raw_rn"]

HAS_RSYNC = shutil.which("rsync") is not None


def run(cmd, shell=False):
    display = cmd if isinstance(cmd, str) else " ".join(str(c) for c in cmd)
    print(f"  $ {display}")
    result = subprocess.run(cmd, shell=shell)
    if result.returncode != 0:
        print(f"  ERROR: exited {result.returncode}")
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
        # Databases: plain scp (single large file, no timeout risk)
        for f in DB_FILES:
            if Path(f).exists():
                run(["scp", "-o", "ServerAliveInterval=30", f, f"{REMOTE_HOST}:{REMOTE_PATH}/"])
        # Directories: tar + gzip piped over SSH (single stream, reliable, compressed)
        for d in RAW_DIRS:
            if Path(d).exists():
                print(f"  [tar pipe] {d}/ -> server")
                cmd = (
                    f'tar czf - {d}/ | '
                    f'ssh -o ServerAliveInterval=30 -o ServerAliveCountMax=6 {REMOTE_HOST} '
                    f'"tar xzf - -C {REMOTE_PATH}/"'
                )
                run(cmd, shell=True)

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
        # Databases: plain scp
        for f in DB_FILES:
            run(["scp", "-o", "ServerAliveInterval=30", f"{REMOTE_HOST}:{REMOTE_PATH}/{f}", "."])
        # Directories: tar piped from server, extracted locally
        for d in RAW_DIRS:
            Path(d).mkdir(exist_ok=True)
            print(f"  [tar pipe] server:{d}/ -> local")
            cmd = (
                f'ssh -o ServerAliveInterval=30 -o ServerAliveCountMax=6 {REMOTE_HOST} '
                f'"tar czf - -C {REMOTE_PATH}/ {d}/" | tar xzf -'
            )
            run(cmd, shell=True)

    print("\nDone. Local copy is up to date.")


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("push", "pull"):
        print(__doc__)
        sys.exit(1)

    mode    = sys.argv[1]
    backend = "rsync" if HAS_RSYNC else "tar+ssh"
    print(f"[sync_data.py] mode={mode}  backend={backend}")

    if mode == "push":
        push()
    else:
        pull()
