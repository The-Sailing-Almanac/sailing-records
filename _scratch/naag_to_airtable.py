#!/usr/bin/env python3
"""
No Agenda Art Generator scraper -> Airtable.

Pulls every artwork into one Airtable table. Each row gets the full-res
(~3k px) image as a hosted attachment plus all metadata.

Resumable: on each run, reads existing Artwork IDs from Airtable and
skips them. Stop and restart anytime.

Setup:
  pip install requests beautifulsoup4
  export AIRTABLE_TOKEN=pat_patrLA495Wfi3Jxpf.29c4d840c39cefac9c1e4c2d67e9abfbaa447cb629022b6e3c39beac315ea29a
  export AIRTABLE_BASE_ID=appmculBtUrdxwrPW
  export AIRTABLE_TABLE=Artworks

Usage:
  python naag_to_airtable.py --max 50      # smoke test
  python naag_to_airtable.py               # full run (~38k records)
"""

from __future__ import annotations
import argparse, os, re, sys, time
from dataclasses import dataclass
from urllib.parse import urljoin, quote
import requests
from bs4 import BeautifulSoup

BASE = "https://noagendaartgenerator.com"
LISTING = BASE + "/artworks"
LICENSE = "CC BY-SA 3.0 US (https://creativecommons.org/licenses/by-sa/3.0/us/)"
UA = "naag-scraper/1.0 (+personal archival; respects robots.txt)"

# Change values here if your Airtable field names differ
F = {
    "id":         "Artwork ID",
    "title":      "Title",
    "artist":     "Artist",
    "artist_url": "Artist URL",
    "episode":    "Episode",
    "page_url":   "Page URL",
    "image_url":  "Image URL",
    "image":      "Image",
    "license":    "License",
    "filename":   "Filename",
}


@dataclass
class Artwork:
    artwork_id: str
    title: str
    artist: str
    artist_url: str
    episode: str
    page_url: str
    image_url: str
    filename: str
    license: str = LICENSE

    def to_airtable_fields(self) -> dict:
        ep = int(self.episode) if self.episode and self.episode.isdigit() else None
        fields = {
            F["id"]:         self.artwork_id,
            F["title"]:      self.title,
            F["artist"]:     self.artist,
            F["artist_url"]: self.artist_url,
            F["page_url"]:   self.page_url,
            F["image_url"]:  self.image_url,
            F["filename"]:   self.filename,
            F["license"]:    self.license,
            F["image"]:      [{"url": self.image_url, "filename": self.filename}],
        }
        if ep is not None:
            fields[F["episode"]] = ep
        return fields


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Accept": "text/html,*/*"})
    return s


def get_with_retry(session, url, *, retries=4, timeout=30):
    backoff = 1.0
    last_exc = None
    for _ in range(retries):
        try:
            r = session.get(url, timeout=timeout)
            if r.status_code == 429 or 500 <= r.status_code < 600:
                wait = float(r.headers.get("Retry-After", backoff))
                time.sleep(wait)
                backoff *= 2
                continue
            r.raise_for_status()
            return r
        except (requests.RequestException, ConnectionError) as e:
            last_exc = e
            time.sleep(backoff)
            backoff *= 2
    raise RuntimeError(f"Failed after {retries} attempts: {url} ({last_exc})")


def parse_listing_page(html: str) -> list[Artwork]:
    soup = BeautifulSoup(html, "html.parser")
    artworks: list[Artwork] = []

    for img in soup.find_all("img", src=re.compile(r"/thumbnails/\d{4}/\d{2}/")):
        thumb_url = img["src"]
        a = img.find_parent("a", href=re.compile(r"/artworks/\d+"))
        if not a:
            continue
        page_url = urljoin(BASE, a["href"])
        artwork_id = page_url.rsplit("/", 1)[-1]

        card = a
        for _ in range(8):
            card = card.parent
            if card is None:
                break
            if card.find(string=re.compile(r"Artwork (By|Submitted For|Selected For)")):
                break
        if card is None:
            continue

        title_tag = card.find(["h2", "h3", "h4"])
        title = title_tag.get_text(strip=True).strip('"\u201c\u201d') if title_tag else ""

        artist_link = card.find("a", href=re.compile(r"/artist/[^/\"]+$"))
        artist = artist_link.get_text(strip=True) if artist_link else ""
        artist_url = urljoin(BASE, artist_link["href"]) if artist_link else ""

        ep_match = re.search(r"Episode\s+([\d,]+)", card.get_text(" ", strip=True))
        episode = ep_match.group(1).replace(",", "") if ep_match else ""

        # Promote thumbnail URL -> full-res by swapping the path segment
        full_url = thumb_url.replace("/thumbnails/", "/artworks/")
        slug = thumb_url.rsplit("/", 1)[-1]
        filename = f"{artwork_id}_{slug}"

        artworks.append(Artwork(
            artwork_id=artwork_id, title=title,
            artist=artist, artist_url=artist_url,
            episode=episode, page_url=page_url,
            image_url=full_url, filename=filename,
        ))
    return artworks


def total_pages(session) -> int:
    r = get_with_retry(session, LISTING)
    soup = BeautifulSoup(r.text, "html.parser")
    nums = [int(m.group(1)) for a in soup.find_all("a", href=True)
            if (m := re.search(r"artworks=(\d+)", a["href"]))]
    return max(nums) if nums else 1


class Airtable:
    BASE_URL = "https://api.airtable.com/v0"
    MAX_BATCH = 10
    REQ_INTERVAL = 0.25  # ~4 req/sec; under the 5/sec/base ceiling

    def __init__(self, token: str, base_id: str, table: str):
        self.url = f"{self.BASE_URL}/{base_id}/{quote(table, safe='')}"
        self.headers = {"Authorization": f"Bearer {token}",
                        "Content-Type": "application/json"}
        self._last_req = 0.0

    def _throttle(self):
        delta = time.monotonic() - self._last_req
        if delta < self.REQ_INTERVAL:
            time.sleep(self.REQ_INTERVAL - delta)
        self._last_req = time.monotonic()

    def _request(self, method: str, **kwargs) -> requests.Response:
        backoff = 1.0
        for _ in range(5):
            self._throttle()
            r = requests.request(method, self.url, headers=self.headers,
                                 timeout=60, **kwargs)
            if r.status_code == 429 or 500 <= r.status_code < 600:
                time.sleep(backoff); backoff *= 2; continue
            if not r.ok:
                raise RuntimeError(f"Airtable {r.status_code}: {r.text}")
            return r
        raise RuntimeError("Airtable request failed after retries")

    def existing_ids(self, id_field: str) -> set[str]:
        ids: set[str] = set()
        params = {"pageSize": 100, "fields[]": id_field}
        while True:
            self._throttle()
            r = requests.get(self.url, headers=self.headers,
                             params=params, timeout=60)
            if not r.ok:
                raise RuntimeError(f"Airtable list {r.status_code}: {r.text}")
            data = r.json()
            for rec in data.get("records", []):
                v = rec.get("fields", {}).get(id_field)
                if v: ids.add(str(v))
            offset = data.get("offset")
            if not offset: return ids
            params["offset"] = offset

    def create_batch(self, artworks: list[Artwork]) -> int:
        if not artworks: return 0
        payload = {"records": [{"fields": a.to_airtable_fields()} for a in artworks],
                   "typecast": True}
        r = self._request("POST", json=payload)
        return len(r.json().get("records", []))


def main() -> int:
    p = argparse.ArgumentParser(description="Scrape NAAG -> Airtable")
    p.add_argument("--token", default=os.environ.get("AIRTABLE_TOKEN"))
    p.add_argument("--base-id", default=os.environ.get("AIRTABLE_BASE_ID"))
    p.add_argument("--table", default=os.environ.get("AIRTABLE_TABLE", "Artworks"))
    p.add_argument("--start-page", type=int, default=1)
    p.add_argument("--end-page", type=int, default=None)
    p.add_argument("--max", type=int, default=None)
    p.add_argument("--delay", type=float, default=0.5)
    args = p.parse_args()

    if not args.token or not args.base_id:
        print("ERROR: need --token and --base-id (or env vars).", file=sys.stderr)
        return 2

    air = Airtable(args.token, args.base_id, args.table)
    session = make_session()

    print("Fetching existing record IDs from Airtable for resume...")
    seen_ids = air.existing_ids(F["id"])
    print(f"  found {len(seen_ids)} already in Airtable.")

    end_page = args.end_page or total_pages(session)
    print(f"Scraping pages {args.start_page}..{end_page}")

    pending: list[Artwork] = []
    pushed = 0

    def flush() -> int:
        nonlocal pending
        if not pending: return 0
        n = air.create_batch(pending)
        for a in pending: seen_ids.add(a.artwork_id)
        pending = []
        return n

    try:
        for page in range(args.start_page, end_page + 1):
            url = LISTING if page == 1 else f"{LISTING}?artworks={page}"
            try:
                resp = get_with_retry(session, url)
            except RuntimeError as e:
                print(f"[page {page}] giving up: {e}", file=sys.stderr)
                continue
            arts = parse_listing_page(resp.text)
            new_arts = [a for a in arts if a.artwork_id not in seen_ids]
            print(f"[page {page}/{end_page}] {len(arts)} items, {len(new_arts)} new")

            for art in new_arts:
                pending.append(art)
                if len(pending) >= Airtable.MAX_BATCH:
                    pushed += flush()
                    if args.max and pushed >= args.max:
                        print(f"Hit --max ({args.max}); stopping.")
                        return 0
                time.sleep(args.delay)
            time.sleep(args.delay)
        pushed += flush()
    except KeyboardInterrupt:
        pushed += flush()
        print("\nInterrupted - pushed records are saved, re-run to resume.")
    except Exception as e:
        try: pushed += flush()
        except Exception: pass
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    print(f"Done. Pushed {pushed} new records to Airtable.")
    return 0


if __name__ == "__main__":
    sys.exit(main())