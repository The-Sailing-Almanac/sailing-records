import sys
import os
import re
from pathlib import Path
import xml.etree.ElementTree as ET
import dateutil.parser as dateparser

ENEX_DIR = Path("/home/aewoodyard/idea-drop/Evernote-Backup/ENEX")
OUTPUT_FEEDS = Path("logs/extracted_sailing_feeds.txt")
OUTPUT_LINKS = Path("logs/extracted_sailing_links.txt")

SAILING_KEYWORDS = [
    "sail", "boat", "yacht", "cruis", "regatta", "wind", "weather", "noon", 
    "passage", "sea", "ocean", "marine", "dock", "anchorage", "rudder", 
    "mast", "rigging", "keel", "hull", "spinnaker", "jib", "tack", "gibe"
]
keyword_regex = re.compile("|".join(SAILING_KEYWORDS), re.IGNORECASE)
url_regex = re.compile(r'https?://[^\s<>"]+|www\.[^\s<>"]+')

def is_sailing_related(text: str) -> bool:
    if not text:
        return False
    return bool(keyword_regex.search(text))

def extract_urls(text: str) -> list:
    if not text:
        return []
    return url_regex.findall(text)

def stream_parse_enex(enex_path: Path):
    """
    Memory-efficient streaming parser for large ENEX XML files.
    Yields tuple of (title, content_text) for relevant notes.
    """
    try:
        # iterparse yields (event, elem) tuples. We look for 'end' of note elements.
        context = ET.iterparse(enex_path, events=('end',))
        for event, elem in context:
            if elem.tag == 'note':
                title_el = elem.find('title')
                title = title_el.text if title_el is not None and title_el.text else ""
                
                content_el = elem.find('content')
                content = content_el.text if content_el is not None and content_el.text else ""
                
                # Yield only if title or content match sailing keyword filters
                if is_sailing_related(title) or is_sailing_related(content):
                    yield title, content
                
                # Crucial step: Clear the element to free memory
                elem.clear()
    except Exception as e:
        print(f"⚠️ Error streaming {enex_path.name}: {e}")

def main():
    print("🌊 Starting Memory-Safe Streamed Evernote Sailing Extraction...")
    if not ENEX_DIR.exists():
        print(f"❌ ENEX directory not found at {ENEX_DIR}")
        return

    enex_files = list(ENEX_DIR.glob("*.enex"))
    print(f"📚 Found {len(enex_files)} ENEX backup files to scan.")

    discovered_feeds = set()
    discovered_links = set()

    for idx, enex_path in enumerate(enex_files):
        print(f"[{idx+1}/{len(enex_files)}] Streaming {enex_path.name} ({enex_path.stat().st_size / 1024 / 1024:.2f} MB)...")
        
        # Scan note items streaming
        for title, content in stream_parse_enex(enex_path):
            urls = extract_urls(content) + extract_urls(title)
            for url in urls:
                clean_url = url.strip().rstrip(".,;:")
                
                # Categorize as feed or link
                if "rss" in clean_url.lower() or "feed" in clean_url.lower() or "xml" in clean_url.lower():
                    discovered_feeds.add(clean_url)
                else:
                    discovered_links.add(clean_url)

    # Write outputs
    os.makedirs("logs", exist_ok=True)
    with open(OUTPUT_FEEDS, "w", encoding="utf-8") as f:
        for feed in sorted(discovered_feeds):
            f.write(f"{feed}\n")

    with open(OUTPUT_LINKS, "w", encoding="utf-8") as f:
        for link in sorted(discovered_links):
            f.write(f"{link}\n")

    print("\n✅ Streamed Extraction complete!")
    print(f"   Extracted Sailing Feeds : {len(discovered_feeds)} saved to {OUTPUT_FEEDS}")
    print(f"   Extracted Sailing Links : {len(discovered_links)} saved to {OUTPUT_LINKS}")

if __name__ == "__main__":
    main()
