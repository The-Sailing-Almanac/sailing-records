#!/usr/bin/env python3
"""
push_to_notion.py — Push stax-kb summary.md files to Notion STAX HQ.

Usage:
  python3 push_to_notion.py --file {repo}-{date}-summary.md [--update]

Requires:
  pip install notion-client md2notionpage python-dotenv
  ~/.env.codebase-kb with NOTION_TOKEN and NOTION_PARENT_PAGE_ID

Page structure created:
  Codebase Knowledge Base  (NOTION_PARENT_PAGE_ID)
  ├── 📋 Fleet Overview  (auto-updated by generate_fleet_overview.py)
  ├── 📁 {REPO} — Codebase Snapshots
  │   ├── {REPO} — daily — YYYY-MM-DD
  │   └── ...
"""

import argparse
import csv
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from dotenv import load_dotenv
    from notion_client import Client
except ImportError:
    print("ERROR: pip install notion-client python-dotenv", file=sys.stderr)
    sys.exit(1)


def load_env():
    env_file = Path.home() / ".env.codebase-kb"
    if env_file.exists():
        load_dotenv(env_file)
    token = os.getenv("NOTION_TOKEN")
    parent_id = os.getenv("NOTION_PARENT_PAGE_ID")
    # Prefer KB sub-page as parent for repo summaries
    kb_page_id = os.getenv("NOTION_KB_PAGE_ID", parent_id)
    if not token or not parent_id:
        print("ERROR: NOTION_TOKEN and NOTION_PARENT_PAGE_ID must be set in ~/.env.codebase-kb",
              file=sys.stderr)
        sys.exit(1)
    return token, kb_page_id


def parse_metadata(md_text: str) -> dict:
    """Extract YAML frontmatter metadata from summary.md."""
    meta = {}
    fm_match = re.match(r"^---\n(.*?)\n---", md_text, re.DOTALL)
    if fm_match:
        for line in fm_match.group(1).splitlines():
            if ":" in line:
                key, _, val = line.partition(":")
                meta[key.strip()] = val.strip()
    return meta


def find_or_create_repo_page(notion: Client, parent_id: str, repo: str) -> str:
    """Find or create the '{REPO} — Codebase Snapshots' parent page."""
    title = f"{repo} — Codebase Snapshots"
    results = notion.search(query=title, filter={"property": "object", "value": "page"})
    for page in results.get("results", []):
        if page.get("parent", {}).get("page_id") == parent_id:
            page_title = ""
            title_prop = page.get("properties", {}).get("title", {})
            if title_prop.get("title"):
                page_title = title_prop["title"][0].get("plain_text", "")
            if page_title == title:
                return page["id"]

    # Create it
    new_page = notion.pages.create(
        parent={"page_id": parent_id},
        properties={"title": {"title": [{"text": {"content": title}}]}},
    )
    return new_page["id"]


def md_to_notion_blocks(md_text: str) -> list:
    """
    Convert Markdown text to Notion blocks.
    Uses md2notionpage if available, falls back to simple paragraph blocks.
    """
    try:
        from md2notionpage import parse_md
        return parse_md(md_text)
    except ImportError:
        pass

    # Fallback: split into paragraph blocks
    blocks = []
    for line in md_text.splitlines():
        if line.startswith("# "):
            blocks.append({
                "object": "block", "type": "heading_1",
                "heading_1": {"rich_text": [{"type": "text", "text": {"content": line[2:]}}]}
            })
        elif line.startswith("## "):
            blocks.append({
                "object": "block", "type": "heading_2",
                "heading_2": {"rich_text": [{"type": "text", "text": {"content": line[3:]}}]}
            })
        elif line.startswith("> "):
            blocks.append({
                "object": "block", "type": "quote",
                "quote": {"rich_text": [{"type": "text", "text": {"content": line[2:]}}]}
            })
        elif line.strip():
            blocks.append({
                "object": "block", "type": "paragraph",
                "paragraph": {"rich_text": [{"type": "text", "text": {"content": line}}]}
            })
    return blocks


def push(args):
    token, parent_id = load_env()
    notion = Client(auth=token)

    md_path = Path(args.file)
    if not md_path.exists():
        print(f"ERROR: file not found: {md_path}", file=sys.stderr)
        sys.exit(1)

    md_text = md_path.read_text(encoding="utf-8")
    meta = parse_metadata(md_text)
    repo = meta.get("repo", md_path.stem.split("-")[0])
    date = meta.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))

    # Determine timeframe from filename
    stem = md_path.stem
    timeframe = "snapshot"
    for tf in ("daily", "weekly", "biweekly", "monthly"):
        if tf in stem:
            timeframe = tf
            break

    page_title = f"{repo} — {timeframe} — {date}"
    print(f"Pushing: {page_title}")

    # Find or create repo container page
    repo_page_id = find_or_create_repo_page(notion, parent_id, repo)

    # Convert MD to Notion blocks
    blocks = md_to_notion_blocks(md_text)

    # Create the dated snapshot page (limit: 100 blocks per API call)
    new_page = notion.pages.create(
        parent={"page_id": repo_page_id},
        properties={"title": {"title": [{"text": {"content": page_title}}]}},
        children=blocks[:100],
    )
    page_url = new_page.get("url", "")
    page_id = new_page["id"]

    # Append remaining blocks if any
    for i in range(100, len(blocks), 100):
        notion.blocks.children.append(
            block_id=page_id,
            children=blocks[i:i + 100],
        )

    print(f"Created: {page_url}")

    # Append to notion-index.csv
    output_dir = md_path.parent.parent
    index_csv = output_dir / "notion-index.csv"
    write_header = not index_csv.exists()
    with open(index_csv, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if write_header:
            writer.writerow(["repo", "timeframe", "date", "notion_url", "file_path"])
        writer.writerow([repo, timeframe, date, page_url, str(md_path)])

    return page_url


def main():
    parser = argparse.ArgumentParser(description="Push stax-kb summary to Notion")
    parser.add_argument("--file", required=True, help="Path to summary.md file")
    parser.add_argument("--update", action="store_true",
                        help="Update existing page instead of creating new one")
    args = parser.parse_args()
    push(args)


if __name__ == "__main__":
    main()
