"""
sailwave_parser.py

Parses saved Sailwave static HTML pages from raw_intl/sailwave/{event_id}/ into
sailing_data.db. Source-language headers and cell text are stored in source_text
before canonical mapping so translations or parser mistakes can be corrected
from preserved originals.
"""
import json
import re
import sqlite3
import time
from html import unescape
from html.parser import HTMLParser
from pathlib import Path

RAW_DIR = Path("raw_intl/sailwave")
DB_PATH = "sailing_data.db"

RACE_RE = re.compile(r"^(?:r|race|rennen|course|prova|prueba)\s*\d+", re.I)
PDF_ROW_RE = re.compile(r"^\s*(?:\d+(?:st|nd|rd|th)?|\d+)\s+", re.I)

HEADER_SYNONYMS = {
    "rank": {
        "rank", "pos", "position", "place", "rang", "platz", "classifica",
        "clasificacion", "classement",
    },
    "class": {"class", "fleet", "division", "klasse", "classe", "clase"},
    "boat": {"boat", "boatname", "boat_name", "boatname", "yacht"},
    "design": {"design", "boatdesign", "boat_design", "type", "boat_type"},
    "sail": {
        "sail", "sailno", "sail_no", "sailnumber", "sail_number",
        "segelnummer", "vela", "voile",
    },
    "helm": {
        "helm", "helmname", "skipper", "competitor", "name", "steuermann",
        "skippername", "sailor", "patron", "timoniere", "caña",
    },
    "crew": {"crew", "crewname", "vorschoter", "equipage", "equipaggio", "tripulacion"},
    "club": {
        "club", "homeclub", "home_club", "yachtclub", "yacht_club",
        "verein", "circolo", "clube", "cn",
    },
    "total": {"total", "points", "punkte", "punti", "puntos"},
    "nett": {"nett", "net", "netto", "netpoints", "net_points"},
}


class SailwaveHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title_parts = []
        self.h1_parts = []
        self.h2_parts = []
        self.tables = []
        self._tag_stack = []
        self._current_table = None
        self._current_row = None
        self._current_cell = None
        self._capture_title = False
        self._capture_h1 = False
        self._capture_h2 = False

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        self._tag_stack.append(tag)
        if tag == "title":
            self._capture_title = True
        elif tag == "h1":
            self._capture_h1 = True
        elif tag == "h2":
            self._capture_h2 = True
        elif tag == "table":
            self._current_table = []
        elif tag == "tr" and self._current_table is not None:
            self._current_row = []
        elif tag in ("td", "th") and self._current_row is not None:
            self._current_cell = []

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "title":
            self._capture_title = False
        elif tag == "h1":
            self._capture_h1 = False
        elif tag == "h2":
            self._capture_h2 = False
        elif tag in ("td", "th") and self._current_cell is not None:
            self._current_row.append(clean_text(" ".join(self._current_cell)))
            self._current_cell = None
        elif tag == "tr" and self._current_row is not None:
            if any(cell for cell in self._current_row):
                self._current_table.append(self._current_row)
            self._current_row = None
        elif tag == "table" and self._current_table is not None:
            if self._current_table:
                self.tables.append(self._current_table)
            self._current_table = None
        if self._tag_stack:
            self._tag_stack.pop()

    def handle_data(self, data):
        if self._capture_title:
            self.title_parts.append(data)
        if self._capture_h1:
            self.h1_parts.append(data)
        if self._capture_h2:
            self.h2_parts.append(data)
        if self._current_cell is not None:
            self._current_cell.append(data)


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def clean_text(value):
    return re.sub(r"\s+", " ", unescape(value or "")).strip()


def normalize_header(value):
    return re.sub(r"[^a-z0-9]+", "", clean_text(value).lower())


def normalize_name(value):
    value = clean_text(value).lower()
    value = re.sub(r"[^\w\s]", " ", value, flags=re.UNICODE)
    return re.sub(r"\s+", " ", value).strip()


def normalize_club(value):
    value = normalize_name(value)
    for token in ("yacht club", "sailing club", "boat club", "yc", "sc", "club", "verein"):
        if value.endswith(" " + token):
            value = value[:-(len(token) + 1)].strip()
    return value


def split_name(full):
    parts = clean_text(full).split()
    suffixes = {"jr", "jr.", "sr", "sr.", "ii", "iii", "iv"}
    while len(parts) > 1 and parts[-1].lower().strip(".") in suffixes:
        parts = parts[:-1]
    if not parts:
        return None, None
    if len(parts) == 1:
        return None, parts[0]
    return parts[0], " ".join(parts[1:])


def header_role(header):
    normalized = normalize_header(header)
    for role, names in HEADER_SYNONYMS.items():
        if normalized in {normalize_header(name) for name in names}:
            return role
    if RACE_RE.match(clean_text(header)):
        return "race"
    if re.match(r"^\d+$", clean_text(header)):
        return "race"
    return "other"


def ensure_schema(con):
    con.execute("""
        CREATE TABLE IF NOT EXISTS source_text (
            id              INTEGER PRIMARY KEY,
            entity_type     TEXT,
            entity_id       INTEGER,
            platform        TEXT,
            source_url      TEXT,
            source_language TEXT,
            field_name      TEXT,
            source_text     TEXT,
            source_context  TEXT,
            parsed_at       TEXT
        )
    """)
    con.execute("""
        CREATE INDEX IF NOT EXISTS idx_source_text_entity
        ON source_text(entity_type, entity_id)
    """)
    con.commit()


def insert_source_text(cur, entity_type, entity_id, meta, field_name, source_text, context):
    if source_text is None:
        return
    cur.execute("""
        INSERT INTO source_text
            (entity_type, entity_id, platform, source_url, source_language,
             field_name, source_text, source_context, parsed_at)
        VALUES (?, ?, 'Sailwave', ?, ?, ?, ?, ?, ?)
    """, (
        entity_type,
        entity_id,
        meta.get("final_url") or meta.get("seed_url"),
        meta.get("language_hint"),
        field_name,
        source_text,
        context,
        now_iso(),
    ))


def upsert_regatta(cur, event_id, event_name, venue, meta):
    raw_url = meta.get("final_url") or meta.get("seed_url")
    cur.execute(
        "SELECT id FROM regattas WHERE platform='Sailwave' AND raw_event_url=? LIMIT 1",
        (raw_url,),
    )
    row = cur.fetchone()
    if row:
        return row[0]

    cur.execute("""
        INSERT INTO regattas
            (event_name, country, platform, is_completed, raw_event_url, parsed_at)
        VALUES (?, ?, 'Sailwave', 1, ?, datetime('now'))
    """, (event_name or event_id, meta.get("country"), raw_url))
    regatta_id = cur.lastrowid
    insert_source_text(cur, "regatta", regatta_id, meta, "event_name", event_name, "title")
    insert_source_text(cur, "regatta", regatta_id, meta, "venue", venue, "subtitle")
    return regatta_id


def upsert_boat(cur, boat_name, sail_number, class_name):
    display = clean_text(boat_name) or clean_text(sail_number) or None
    if display:
        cur.execute(
            "SELECT id FROM boats WHERE lower(name)=lower(?) LIMIT 1",
            (display,),
        )
        row = cur.fetchone()
        if row:
            return row[0]
    cur.execute("""
        INSERT INTO boats
            (yacht_scoring_boat_id, name, design, parsed_at)
        VALUES (NULL, ?, ?, datetime('now'))
    """, (display, class_name or None))
    return cur.lastrowid


def upsert_sailor(cur, full_name, club_raw, country):
    full = clean_text(full_name)
    if not full:
        return None
    norm = normalize_name(full)
    club_norm = normalize_club(club_raw)
    if club_norm:
        cur.execute(
            "SELECT id FROM sailors WHERE name_normalized=? AND club_normalized=? LIMIT 1",
            (norm, club_norm),
        )
        row = cur.fetchone()
        if row:
            return row[0]
    cur.execute("SELECT id FROM sailors WHERE name_normalized=? LIMIT 1", (norm,))
    row = cur.fetchone()
    if row:
        return row[0]

    first, last = split_name(full)
    cur.execute("""
        INSERT INTO sailors
            (full_name, first_name, last_name, club, club_normalized, country,
             match_confidence, name_normalized, parsed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    """, (
        full,
        first,
        last,
        club_raw or None,
        club_norm or None,
        country or None,
        "name+club" if club_norm else "name_only",
        norm,
    ))
    return cur.lastrowid


def insert_participation(cur, sailor_id, boat_id, regatta_id, role, class_name):
    try:
        cur.execute("""
            INSERT INTO participation
                (sailor_id, boat_id, regatta_id, role, cs_class_name)
            VALUES (?, ?, ?, ?, ?)
        """, (sailor_id, boat_id, regatta_id, role, class_name or None))
    except sqlite3.IntegrityError:
        pass


def insert_race_result(cur, regatta_id, boat_id, class_name, race_number, raw_value):
    text = clean_text(raw_value)
    if not text:
        return
    score_match = re.search(r"\d+(?:\.\d+)?", text)
    status_match = re.search(r"\b([A-Z]{2,4})\b", text)
    race_value = float(score_match.group(0)) if score_match else None
    finish_status = status_match.group(1) if status_match else "FIN"
    try:
        cur.execute("""
            INSERT INTO race_results
                (regatta_id, boat_id, class_name, race_number, finish_status,
                 race_value, sort_value)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (regatta_id, boat_id, class_name, race_number, finish_status, race_value, race_value))
    except sqlite3.IntegrityError:
        pass


def insert_boat_race_result(cur, regatta_id, boat_id, class_name, race_number, points):
    try:
        cur.execute("""
            INSERT INTO race_results
                (regatta_id, boat_id, class_name, race_number, finish_status,
                 race_value, sort_value)
            VALUES (?, ?, ?, ?, 'FIN', ?, ?)
        """, (regatta_id, boat_id, class_name, race_number, points, points))
    except sqlite3.IntegrityError:
        pass


def load_metadata(folder):
    path = folder / "metadata.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def extract_pdf_text(source_path):
    try:
        from pypdf import PdfReader
    except ImportError:
        return None
    reader = PdfReader(str(source_path))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def event_title(parsed, event_id):
    h1 = clean_text(" ".join(parsed.h1_parts))
    if h1:
        return h1
    title = clean_text(" ".join(parsed.title_parts))
    return title or event_id


def event_venue(parsed):
    return clean_text(" ".join(parsed.h2_parts)) or None


def result_tables(parsed):
    for table in parsed.tables:
        if not table:
            continue
        headers = table[0]
        roles = [header_role(h) for h in headers]
        if ("helm" in roles or "boat" in roles) and ("rank" in roles or "sail" in roles):
            yield table, headers, roles


def parse_rows(table, headers, roles):
    for row_index, cells in enumerate(table[1:], 1):
        if not cells or len(cells) < 2:
            continue
        values = {}
        raw_cells = []
        race_number = 0
        for i, cell_text in enumerate(cells):
            header = headers[i] if i < len(headers) else f"column_{i + 1}"
            role = roles[i] if i < len(roles) else "other"
            if role == "race":
                race_number += 1
                raw_cells.append(("race", race_number, header, cell_text))
            elif role not in values:
                values[role] = cell_text
            raw_cells.append((role, i + 1, header, cell_text))
        if values.get("helm") or values.get("boat"):
            yield row_index, values, raw_cells


def parse_file(folder, con):
    meta = load_metadata(folder)
    source_path = folder / meta.get("source_filename", "source.html")
    if not source_path.exists():
        return "missing_source", 0
    if source_path.suffix.lower() != ".html":
        if source_path.suffix.lower() == ".pdf":
            return parse_pdf_file(folder, source_path, meta, con)
        return "unsupported_source", 0
    html = source_path.read_bytes().decode("utf-8", errors="replace")
    parsed = SailwaveHTMLParser()
    parsed.feed(html)
    event_id = folder.name
    title = event_title(parsed, event_id)
    venue = event_venue(parsed)
    tables = list(result_tables(parsed))
    if not tables:
        return "no_entries", 0

    cur = con.cursor()
    source_url = meta.get("final_url") or meta.get("seed_url")
    if source_url:
        cur.execute(
            "DELETE FROM source_text WHERE platform='Sailwave' AND source_url=?",
            (source_url,),
        )
    regatta_id = upsert_regatta(cur, event_id, title, venue, meta)
    entries = 0

    for table_index, (table, headers, roles) in enumerate(tables, 1):
        for col_index, header in enumerate(headers, 1):
            insert_source_text(
                cur, "source_column", None, meta, f"table_{table_index}_column_{col_index}",
                header, "table_header",
            )
        for row_index, values, raw_cells in parse_rows(table, headers, roles):
            class_name = values.get("class") or values.get("design")
            sail_number = values.get("sail")
            club = values.get("club")
            helm = values.get("helm")
            crew = values.get("crew")
            boat_id = upsert_boat(cur, values.get("boat"), sail_number, class_name)
            sailor_id = upsert_sailor(cur, helm, club, meta.get("country")) if helm else None
            if sailor_id:
                insert_participation(cur, sailor_id, boat_id, regatta_id, "skipper", class_name)
                insert_source_text(cur, "sailor", sailor_id, meta, "full_name", helm, "row_cell")
                insert_source_text(cur, "sailor", sailor_id, meta, "club", club, "row_cell")
            if crew:
                crew_id = upsert_sailor(cur, crew, club, meta.get("country"))
                if crew_id:
                    insert_participation(cur, crew_id, boat_id, regatta_id, "crew", class_name)
                    insert_source_text(cur, "sailor", crew_id, meta, "full_name", crew, "row_cell")
            race_number = 0
            for role, _, header, cell_text in raw_cells:
                if role == "race":
                    race_number += 1
                    insert_race_result(cur, regatta_id, boat_id, class_name, race_number, cell_text)
                if cell_text:
                    insert_source_text(
                        cur,
                        "participation",
                        None,
                        meta,
                        header,
                        cell_text,
                        f"table_{table_index}_row_{row_index}",
                    )
            entries += 1

    return "ok" if entries else "no_entries", entries


def pdf_event_name(folder, text):
    for line in reversed([clean_text(line) for line in text.splitlines()]):
        if line and not PDF_ROW_RE.match(line) and "rank " not in line.lower():
            return line
    return folder.name


def pdf_points(tokens):
    for token in reversed(tokens):
        cleaned = re.sub(r"[^0-9.]", "", token)
        if cleaned:
            try:
                return float(cleaned)
            except ValueError:
                continue
    return None


def pdf_boat_name(tokens):
    if len(tokens) < 2:
        return " ".join(tokens)
    body = tokens[1:]
    rating_index = None
    for i, token in enumerate(body):
        if re.match(r"^\d+\.\d+$", token):
            rating_index = i
            break
    if rating_index is not None and rating_index > 0:
        body = body[:rating_index]
    return clean_text(" ".join(body)) or None


def parse_pdf_file(folder, source_path, meta, con):
    text = extract_pdf_text(source_path)
    if text is None:
        return "unsupported_source", 0
    cur = con.cursor()
    source_url = meta.get("final_url") or meta.get("seed_url")
    if source_url:
        cur.execute(
            "DELETE FROM source_text WHERE platform='Sailwave' AND source_url=?",
            (source_url,),
        )

    event_name = pdf_event_name(folder, text)
    regatta_id = upsert_regatta(cur, folder.name, event_name, None, meta)
    entries = 0
    race_number = 0
    current_class = None

    for line_number, raw_line in enumerate(text.splitlines(), 1):
        line = clean_text(raw_line)
        if not line:
            continue
        insert_source_text(
            cur, "source_column", None, meta, f"pdf_line_{line_number}",
            line, "pdf_text_line",
        )
        lower = line.lower()
        if lower.startswith("rank "):
            race_number += 1
            current_class = None
            continue
        if not PDF_ROW_RE.match(line):
            if "division" in lower or "race" in lower:
                current_class = line
            continue
        tokens = line.split()
        boat_name = pdf_boat_name(tokens)
        if not boat_name:
            continue
        points = pdf_points(tokens)
        boat_id = upsert_boat(cur, boat_name, None, current_class)
        insert_boat_race_result(cur, regatta_id, boat_id, current_class, max(race_number, 1), points)
        insert_source_text(
            cur, "boat", boat_id, meta, "pdf_result_row",
            line, f"pdf_line_{line_number}",
        )
        entries += 1

    return "ok_pdf" if entries else "no_entries", entries


def main():
    con = sqlite3.connect(DB_PATH, timeout=30)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=NORMAL")
    ensure_schema(con)

    folders = sorted(p for p in RAW_DIR.iterdir() if p.is_dir()) if RAW_DIR.exists() else []
    stats = {}
    for folder in folders:
        try:
            status, entries = parse_file(folder, con)
            con.commit()
            print(f"{status:>12}  {entries:>4} entries  {folder.name}", flush=True)
        except Exception as e:
            con.rollback()
            status = f"err-{type(e).__name__}"
            print(f"{status:>12}  {folder.name}: {e}", flush=True)
        stats[status] = stats.get(status, 0) + 1

    con.close()
    print(f"\nDone. Final counts: {stats}", flush=True)


if __name__ == "__main__":
    main()
