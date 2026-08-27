#!/usr/bin/env python3
"""
generate_dual_db.py — STAX Knowledge Base dual-database generator.

For each repo processed by codebase-kb.sh, this script takes the Repomix JSON output
and produces two parallel artifacts:
  - {repo}-{date}-manifest.json  (machine DB, stable block IDs, jq-queryable)
  - {repo}-{date}-summary.md     (human DB, ID-anchored Markdown, Obsidian-ready)

Block IDs are PERMANENT. A file that moves paths keeps its original ID. Never reassign.
On re-run: load previous manifest, preserve existing IDs, only assign new IDs to new files.

Usage:
  python3 generate_dual_db.py \\
    --input {repo}-{date}.json \\
    --repo-abbrev STX \\
    --repo stax \\
    --timeframe daily \\
    --output-dir ~/codebase-kb-outputs \\
    [--notebooklm]
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def load_previous_manifest(output_dir: Path, repo: str) -> dict:
    """Load the most recent existing manifest for this repo to preserve block IDs."""
    machine_dir = output_dir / "machine"
    pattern = f"{repo}-*-manifest.json"
    manifests = sorted(machine_dir.glob(pattern), reverse=True)
    if manifests:
        with open(manifests[0]) as f:
            return json.load(f)
    return {}


def assign_block_ids(files: list[dict], prev_manifest: dict, abbrev: str) -> dict:
    """
    Assign stable block IDs to files. Preserve existing IDs from previous manifest.
    Never reassign. Files that move paths keep their original ID (matched by path).
    Returns: {path: block_id}
    """
    # Build path → ID map from previous manifest
    existing = {}
    if "blocks" in prev_manifest:
        for block in prev_manifest["blocks"]:
            existing[block["path"]] = block["id"]

    # Find highest existing seq number
    seq = 0
    for bid in existing.values():
        m = re.match(r"[A-Z]+-(\d+)$", bid)
        if m:
            seq = max(seq, int(m.group(1)))

    result = {}
    for f in files:
        path = f.get("path", "")
        if path in existing:
            result[path] = existing[path]
        else:
            seq += 1
            result[path] = f"{abbrev}-{seq:03d}"
    return result


def infer_purpose(path: str, first_lines: str = "") -> str:
    """
    Infer a human-readable purpose label from the file path and first 20 lines.
    No LLM call — pure string heuristics.
    """
    p = Path(path)
    name = p.stem.replace("_", " ").replace("-", " ")

    # Common pattern mappings
    patterns = {
        "auth": "Authentication",
        "service": "Service Layer",
        "model": "Data Model",
        "handler": "Request Handler",
        "controller": "Controller",
        "route": "Route Definition",
        "middleware": "Middleware",
        "util": "Utilities",
        "helper": "Helpers",
        "config": "Configuration",
        "test": "Tests",
        "spec": "Specification",
        "schema": "Schema",
        "migration": "Database Migration",
        "seed": "Database Seed",
        "deploy": "Deployment",
        "workflow": "Workflow",
        "ops": "Operations",
        "harvester": "Data Harvester",
        "streamer": "Data Streamer",
        "agent": "Agent Logic",
        "bot": "Bot Logic",
        "dashboard": "Dashboard",
        "api": "API Layer",
        "index": "Index / Entry Point",
        "readme": "Documentation",
    }

    lower = name.lower()
    for key, label in patterns.items():
        if key in lower:
            return f"{label} — {name.title()}"

    # Fall back to title-cased filename
    return name.title()


def extract_docstring(content: str, lang: str) -> str:
    """Extract the first docstring or top comment block from file content."""
    lines = content.splitlines()[:30]

    if lang in ("python",):
        in_doc = False
        doc_lines = []
        for line in lines:
            stripped = line.strip()
            if not in_doc and (stripped.startswith('"""') or stripped.startswith("'''")):
                in_doc = True
                inner = stripped[3:]
                if inner:
                    doc_lines.append(inner)
                continue
            if in_doc:
                if stripped.endswith('"""') or stripped.endswith("'''"):
                    inner = stripped[:-3]
                    if inner:
                        doc_lines.append(inner)
                    break
                doc_lines.append(line.strip())
        if doc_lines:
            return " ".join(doc_lines[:3]).strip()

    # Generic: first non-empty comment block
    comment_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(("#", "//", "*", "/*", "<!--")):
            clean = re.sub(r"^[/#*<!-]+\s*", "", stripped)
            if clean:
                comment_lines.append(clean)
        elif comment_lines:
            break
    if comment_lines:
        return " ".join(comment_lines[:3]).strip()

    return ""


def extract_imports(content: str) -> list[str]:
    """Extract imported module/file references for cross-reference section."""
    imports = []
    for line in content.splitlines()[:50]:
        # Python / JS / TS imports
        m = re.search(r"""(?:from|import)\s+['"]?([\w./\-]+)['"]?""", line)
        if m:
            imports.append(m.group(1))
        # Require
        m = re.search(r"""require\(['"]([^'"]+)['"]\)""", line)
        if m:
            imports.append(m.group(1))
    return list(dict.fromkeys(imports))[:5]  # dedupe, cap at 5


def infer_lang(path: str) -> str:
    ext_map = {
        ".py": "python", ".js": "javascript", ".ts": "typescript",
        ".tsx": "tsx", ".jsx": "jsx", ".rs": "rust", ".go": "go",
        ".rb": "ruby", ".java": "java", ".cs": "csharp", ".cpp": "cpp",
        ".c": "c", ".sh": "shell", ".md": "markdown", ".json": "json",
        ".yaml": "yaml", ".yml": "yaml", ".toml": "toml", ".html": "html",
        ".css": "css", ".sql": "sql",
    }
    suffix = Path(path).suffix.lower()
    return ext_map.get(suffix, "text")


def get_last_commit(repo_path: str, file_path: str) -> str:
    """Get last commit date for a file via git log."""
    try:
        result = subprocess.run(
            ["git", "-C", repo_path, "log", "-1", "--format=%cI", "--", file_path],
            capture_output=True, text=True, timeout=5
        )
        date = result.stdout.strip()
        return date[:10] if date else ""
    except Exception:
        return ""


def generate(args):
    input_path = Path(args.input).resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    machine_dir = output_dir / "machine"
    human_dir = output_dir / "human"
    machine_dir.mkdir(parents=True, exist_ok=True)
    human_dir.mkdir(parents=True, exist_ok=True)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    repo = args.repo
    abbrev = args.abbrev.upper()
    timeframe = args.timeframe

    # Load Repomix JSON
    with open(input_path) as f:
        data = json.load(f)

    files_raw = data.get("files", {})
    if isinstance(files_raw, dict):
        file_list = [{"path": k, "content": v} for k, v in files_raw.items()]
    elif isinstance(files_raw, list):
        file_list = files_raw
    else:
        print(f"ERROR: unexpected 'files' format in {input_path}", file=sys.stderr)
        sys.exit(1)

    # Load previous manifest for ID preservation
    prev_manifest = load_previous_manifest(output_dir, repo)
    id_map = assign_block_ids(file_list, prev_manifest, abbrev)

    # Changed blocks = files modified in this run (present in input)
    changed_block_ids = [id_map[f["path"]] for f in file_list]

    # Build manifest blocks
    blocks = []
    for f in file_list:
        path = f.get("path", "")
        content = f.get("content", "")
        lang = infer_lang(path)
        lines = content.count("\n") + 1
        last_commit = get_last_commit(str(input_path.parent.parent), path)
        block_id = id_map[path]
        blocks.append({
            "id": block_id,
            "path": path,
            "lang": lang,
            "lines": lines,
            "last_commit": last_commit,
            "summary_ref": block_id,
        })

    manifest = {
        "repo": repo,
        "abbrev": abbrev,
        "generated": datetime.now(timezone.utc).isoformat(),
        "branch": data.get("metadata", {}).get("branch", "main"),
        "timeframe": timeframe,
        "total_blocks": len(blocks),
        "changed_blocks_this_run": changed_block_ids,
        "blocks": blocks,
    }

    manifest_path = machine_dir / f"{repo}-{today}-manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"manifest → {manifest_path}")

    # Generate summary.md
    summary_lines = [
        f"---",
        f"repo: {repo}",
        f"block_id: {abbrev}-000",
        f"category: {getattr(args, 'category', 'owned')}",
        f"date: {today}",
        f"branch: {manifest['branch']}",
        f"tags: [{infer_lang(file_list[0]['path']) if file_list else 'unknown'}]",
        f"---",
        f"",
        f"# {repo} — {timeframe} snapshot ({today})",
        f"",
        f"**Changed files:** {len(file_list)}  ",
        f"**Timeframe:** {timeframe}  ",
        f"**Branch:** {manifest['branch']}",
        f"",
        f"---",
        f"",
    ]

    for block in blocks:
        purpose = infer_purpose(block["path"])
        content = next((f.get("content", "") for f in file_list if f.get("path") == block["path"]), "")
        docstring = extract_docstring(content, block["lang"])
        imports = extract_imports(content)

        summary_lines.append(f"## {purpose} [{block['id']}]")
        summary_lines.append(f"")
        summary_lines.append(
            f"> **Block ID:** {block['id']} | "
            f"**File:** `{block['path']}` | "
            f"**Lines:** {block['lines']}" +
            (f" | **Last Commit:** {block['last_commit']}" if block['last_commit'] else "")
        )
        summary_lines.append(f"")
        if docstring:
            summary_lines.append(f"_{docstring}_")
            summary_lines.append(f"")
        if imports:
            summary_lines.append(f"**Imports:** {', '.join(f'`{i}`' for i in imports)}")
            summary_lines.append(f"")
        summary_lines.append(f"---")
        summary_lines.append(f"")

    summary_path = human_dir / f"{repo}-{today}-summary.md"
    with open(summary_path, "w", encoding="utf-8") as f:
        f.write("\n".join(summary_lines))
    print(f"summary  → {summary_path}")

    # Update master-manifest.json
    master_path = output_dir / "master-manifest.json"
    master = {}
    if master_path.exists():
        with open(master_path) as f:
            master = json.load(f)
    master.setdefault("repos", {})[repo] = {
        "abbrev": abbrev,
        "category": getattr(args, "category", "owned"),
        "latest": today,
        "manifests": [str(manifest_path.relative_to(output_dir))],
        "block_count": len(blocks),
    }
    master["generated"] = datetime.now(timezone.utc).isoformat()
    with open(master_path, "w") as f:
        json.dump(master, f, indent=2)
    print(f"master   → {master_path}")

    # NotebookLM upload (optional)
    if args.notebooklm:
        title = f"{repo} — {timeframe} — {today}"
        cmd = ["notebooklm", "add-source", "--notebook", repo,
               "--file", str(summary_path), "--title", title]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                print(f"notebooklm → uploaded to notebook '{repo}'")
            else:
                print(f"notebooklm → FAILED: {result.stderr.strip()}", file=sys.stderr)
        except FileNotFoundError:
            print(f"notebooklm → skipped (notebooklm-py not installed)", file=sys.stderr)

    # Print link table
    print(f"\n{'Block ID':<12} {'File':<50} {'Summary Section':<30} {'NLM'}")
    print("-" * 100)
    for block in blocks[:20]:
        nlm = "✓" if args.notebooklm else "-"
        purpose = infer_purpose(block["path"])[:28]
        print(f"{block['id']:<12} {block['path']:<50} {purpose:<30} {nlm}")
    if len(blocks) > 20:
        print(f"  ... and {len(blocks) - 20} more blocks")


def main():
    parser = argparse.ArgumentParser(description="Generate dual-format KB artifacts from Repomix JSON")
    parser.add_argument("--input", required=True, help="Repomix JSON input file")
    parser.add_argument("--repo", required=True, help="Repo name (e.g. stax)")
    parser.add_argument("--abbrev", required=True, help="Block ID abbreviation (e.g. STX)")
    parser.add_argument("--timeframe", default="daily",
                        choices=["daily", "weekly", "biweekly", "monthly", "all"])
    parser.add_argument("--output-dir", default="~/codebase-kb-outputs",
                        help="Base output directory")
    parser.add_argument("--category", default="owned",
                        choices=["owned", "forked", "starred"])
    parser.add_argument("--notebooklm", action="store_true",
                        help="Upload summary.md to NotebookLM via notebooklm-py")
    args = parser.parse_args()
    generate(args)


if __name__ == "__main__":
    main()
