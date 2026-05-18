"""
detect_families.py

Identifies sailing families and assigns family_id to sailors in sailing_data.db.

Strategy (in order, highest confidence first):
  - Step A0: Pre-merge same-name-same-boat sailors into canonical identities.
  - Step B:  Within a (boat, regatta), same normalized name = same person.
  - Step C:  Tier 1 - same surname, same boat, same regatta = family.
  - Step D:  Tier 2 - same surname, same persistent boat across years = family.
  - Step E:  Tier 3 - same surname + same club, across boats/regattas.
  - Step F:  Write families table and set family_id on canonical sailors.

Idempotent: drops and rebuilds the families and sailor_alias tables each run.
"""
import re
import sqlite3
import time
from collections import defaultdict

DB_PATH = "sailing_data.db"

NON_FAMILY_LASTNAMES = {
    # Organizational
    "sailing", "yacht", "club", "team", "academy", "university",
    "college", "school", "association", "foundation",
    "fleet", "trust", "institute", "center", "centre",
    # Military/group
    "warriors", "marines", "legion", "corps",
    # ICSA division colors
    "blue", "red", "gold", "silver", "green", "white", "black",
    "yellow", "orange", "purple",
    # Fleet/class/division labels
    "junior", "master", "masters", "open", "start", "phrf",
    "spinnaker", "cruiser", "cruising", "racing", "offshore",
    "inshore", "classic", "vintage", "corinthian", "sportboat",
    "corrected", "division", "fleet", "class", "section",
    "scratch", "handicap", "rating", "overall", "combined",
    # Directions/generic
    "north", "south", "east", "west", "central",
    # Common non-name tokens
    "test", "unknown", "none", "na", "tbd",
    # Days of week (appear in weekly race series names)
    "monday", "tuesday", "wednesday", "thursday", "friday",
    "saturday", "sunday",
    # Months (appear in regatta series names)
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
}

COMMON_LASTNAMES = {
    "smith", "johnson", "williams", "brown", "jones", "garcia", "miller",
    "davis", "rodriguez", "martinez", "hernandez", "lopez", "gonzalez",
    "wilson", "anderson", "thomas", "taylor", "moore", "jackson", "martin",
    "lee", "perez", "thompson", "white", "harris", "sanchez", "clark",
    "ramirez", "lewis", "robinson", "walker", "young", "allen", "king",
    "wright", "scott", "torres", "nguyen", "hill", "flores", "green",
    "adams", "nelson", "baker", "hall", "rivera", "campbell", "mitchell",
    "carter", "roberts", "murphy", "kennedy",
}

MIN_VALID_YEAR        = 1950
MAX_VALID_YEAR        = 2030
COMMON_SURNAME_MAX_SPAN    = 35
COMMON_SURNAME_MAX_SAILORS = 15
MIN_LASTNAME_LEN      = 3

COMPOUND_SPLITTERS = re.compile(r"\s*(?:/|&|\sand\s)\s*", re.IGNORECASE)
PUNCT  = re.compile(r"[^\w\s]")
WS     = re.compile(r"\s+")
DIGITS = re.compile(r"^\d+$")


def normalize(s):
    if not s:
        return ""
    s = s.lower().strip()
    s = PUNCT.sub("", s)
    s = WS.sub(" ", s)
    return s.strip()


def split_compound(full_name):
    if not full_name:
        return []
    parts = [p.strip() for p in COMPOUND_SPLITTERS.split(full_name) if p.strip()]
    if len(parts) <= 1:
        return [full_name.strip()]
    if all(len(p.split()) >= 2 for p in parts):
        return parts
    last_part   = parts[-1]
    last_tokens = last_part.split()
    if len(last_tokens) >= 2:
        surname = last_tokens[-1]
        out = [f"{p} {surname}" for p in parts[:-1]]
        out.append(last_part)
        return out
    return parts


def last_name_of(full_name):
    if not full_name:
        return None
    tokens = full_name.strip().split()
    if not tokens:
        return None
    suffix_set = {"jr", "jr.", "sr", "sr.", "ii", "iii", "iv"}
    while len(tokens) > 1 and tokens[-1].lower().strip(".") in suffix_set:
        tokens = tokens[:-1]
    return tokens[-1] if tokens else None


def is_valid_surname(ln_norm):
    if not ln_norm:
        return False
    if len(ln_norm) < MIN_LASTNAME_LEN:
        return False
    if DIGITS.match(ln_norm):
        return False
    # Reject any name containing a digit (catches ICSA codes like B1Y2Gold)
    if any(c.isdigit() for c in ln_norm):
        return False
    if ln_norm in NON_FAMILY_LASTNAMES:
        return False
    return True


def clamp_years(year_set):
    return {y for y in year_set if y and MIN_VALID_YEAR <= y <= MAX_VALID_YEAR}


# -------- Union-Find --------------------------------------------------

class UnionFind:
    def __init__(self):
        self.parent   = {}
        self.evidence = defaultdict(list)

    def find(self, x):
        if x not in self.parent:
            self.parent[x] = x
            return x
        root = x
        while self.parent[root] != root:
            root = self.parent[root]
        while self.parent[x] != root:
            self.parent[x], x = root, self.parent[x]
        return root

    def union(self, a, b, evidence=None):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            if evidence:
                self.evidence[ra].append(evidence)
            return
        if rb < ra:
            ra, rb = rb, ra
        self.parent[rb] = ra
        self.evidence[ra].extend(self.evidence.pop(rb, []))
        if evidence:
            self.evidence[ra].append(evidence)

    def groups(self):
        out = defaultdict(set)
        for x in list(self.parent):
            out[self.find(x)].add(x)
        return out


# -------- Step A0: same-name-same-boat sailor identity merge ----------

def build_sailor_aliases(con, parts):
    cur = con.cursor()
    cur.execute("DROP TABLE IF EXISTS sailor_alias")
    cur.execute("""
        CREATE TABLE sailor_alias (
            sailor_id    INTEGER PRIMARY KEY,
            canonical_id INTEGER NOT NULL
        )
    """)

    sailor_norm = {}
    for sid, nn in cur.execute("SELECT id, name_normalized FROM sailors"):
        sailor_norm[sid] = nn or ""

    sailor_boats = defaultdict(set)
    for p in parts:
        if p["boat_id"] is not None:
            sailor_boats[p["sailor_id"]].add(p["boat_id"])

    norm_to_sids = defaultdict(list)
    for sid, nn in sailor_norm.items():
        if nn:
            norm_to_sids[nn].append(sid)

    uf     = UnionFind()
    merges = 0
    for nn, sids in norm_to_sids.items():
        if len(sids) < 2:
            continue
        if len(nn) < 4:
            continue
        n = len(sids)
        for i in range(n):
            a  = sids[i]
            ba = sailor_boats.get(a, set())
            if not ba:
                continue
            for j in range(i + 1, n):
                b  = sids[j]
                bb = sailor_boats.get(b, set())
                if ba & bb:
                    uf.union(a, b, evidence=("same_name_same_boat", nn))
                    merges += 1

    canonical = {}
    for sid in sailor_norm:
        canonical[sid] = uf.find(sid) if sid in uf.parent else sid

    rows = [(sid, cid) for sid, cid in canonical.items()]
    cur.executemany(
        "INSERT INTO sailor_alias (sailor_id, canonical_id) VALUES (?,?)", rows
    )
    con.commit()
    return canonical, merges


# -------- Main -------------------------------------------------------

def main():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    cur.execute("DROP TABLE IF EXISTS families")
    cur.execute("""
        CREATE TABLE families (
            id            INTEGER PRIMARY KEY,
            surname       TEXT NOT NULL,
            sailor_count  INTEGER NOT NULL,
            regatta_count INTEGER NOT NULL,
            boat_count    INTEGER NOT NULL,
            year_span     INTEGER,
            confidence    TEXT NOT NULL,
            evidence      TEXT
        )
    """)
    cur.execute("UPDATE sailors SET family_id = NULL")
    con.commit()

    started = time.time()
    print("Loading sailors and participations...", flush=True)

    sailors = {row["id"]: dict(row) for row in cur.execute("""
        SELECT id, full_name, first_name, last_name, club, club_normalized,
               country, match_confidence, name_normalized
        FROM sailors
    """)}

    parts = list(cur.execute("""
        SELECT sailor_id, boat_id, regatta_id, role FROM participation
    """))

    regatta_year = {}
    for row in cur.execute("SELECT id, start_date FROM regattas"):
        year = None
        if row["start_date"]:
            try:
                y = int(row["start_date"][:4])
                if MIN_VALID_YEAR <= y <= MAX_VALID_YEAR:
                    year = y
            except (ValueError, TypeError):
                year = None
        regatta_year[row["id"]] = year

    print(f"  {len(sailors):,} sailors, {len(parts):,} participations,"
          f" {len(regatta_year):,} regattas", flush=True)

    # ---- Step A0 -------------------------------------------------------
    canonical, merges_a0 = build_sailor_aliases(con, parts)
    distinct_canonicals  = len(set(canonical.values()))
    print(f"  Step A0: {merges_a0} same-name-same-boat merges  "
          f"({len(sailors):,} sailor records -> {distinct_canonicals:,} identities)",
          flush=True)

    canon_parts = []
    for p in parts:
        cid = canonical.get(p["sailor_id"], p["sailor_id"])
        canon_parts.append({
            "sailor_id":  cid,
            "boat_id":    p["boat_id"],
            "regatta_id": p["regatta_id"],
            "role":       p["role"],
        })

    canon_info = {}
    for sid, s in sailors.items():
        cid      = canonical.get(sid, sid)
        existing = canon_info.get(cid)
        score    = {"id": 3, "name+club": 2, "name_only": 1}.get(
            s["match_confidence"], 0)
        existing_score = (
            {"id": 3, "name+club": 2, "name_only": 1}.get(
                existing["match_confidence"], 0) if existing else -1)
        if score > existing_score:
            canon_info[cid] = s

    expanded = {}
    for cid, s in canon_info.items():
        components = split_compound(s["full_name"] or "")
        rows = []
        for comp in components:
            ln      = last_name_of(comp)
            ln_norm = normalize(ln) if ln else None
            rows.append((comp, ln_norm))
        expanded[cid] = rows

    uf = UnionFind()

    # ---- Step B --------------------------------------------------------
    boat_reg = defaultdict(set)
    for p in canon_parts:
        boat_reg[(p["boat_id"], p["regatta_id"])].add(p["sailor_id"])

    same_person_merges = 0
    for (boat_id, reg_id), sid_set in boat_reg.items():
        if len(sid_set) < 2:
            continue
        names_here = defaultdict(list)
        for sid in sid_set:
            s = canon_info.get(sid)
            if not s:
                continue
            nn = s["name_normalized"]
            if nn:
                names_here[nn].append(sid)
        for nn, sids in names_here.items():
            if len(sids) >= 2:
                primary = sids[0]
                for other in sids[1:]:
                    uf.union(primary, other,
                             evidence=("same_person", boat_id, reg_id, nn))
                    same_person_merges += 1

    print(f"  Step B: {same_person_merges} residual duplicate-sailor merges",
          flush=True)

    # ---- Step C: Tier 1 ------------------------------------------------
    by_boat_reg = defaultdict(list)
    for p in canon_parts:
        by_boat_reg[(p["regatta_id"], p["boat_id"])].append(p["sailor_id"])

    tier1_links = 0
    for (reg_id, boat_id), sid_list in by_boat_reg.items():
        surname_groups = defaultdict(list)
        for sid in sid_list:
            for _disp, ln_norm in expanded.get(sid, []):
                if not is_valid_surname(ln_norm):
                    continue
                surname_groups[ln_norm].append(sid)
        for surname, group_sids in surname_groups.items():
            uniq = list(set(group_sids))
            if len(uniq) < 2:
                continue
            anchor = uniq[0]
            for other in uniq[1:]:
                uf.union(anchor, other,
                         evidence=("tier1_same_boat_regatta",
                                   surname, boat_id, reg_id))
                tier1_links += 1

    print(f"  Step C (Tier 1): {tier1_links} same-boat/same-regatta links",
          flush=True)

    # ---- Step D: Tier 2 ------------------------------------------------
    by_boat = defaultdict(list)
    for p in canon_parts:
        yr = regatta_year.get(p["regatta_id"])
        by_boat[p["boat_id"]].append((p["sailor_id"], yr))

    tier2_links = 0
    for boat_id, entries in by_boat.items():
        surname_to_years = defaultdict(lambda: defaultdict(set))
        for sid, yr in entries:
            for _disp, ln_norm in expanded.get(sid, []):
                if not is_valid_surname(ln_norm):
                    continue
                surname_to_years[ln_norm][sid].add(yr)
        for surname, sid_year_map in surname_to_years.items():
            if len(sid_year_map) < 2:
                continue
            all_years = clamp_years(
                {y for ys in sid_year_map.values() for y in ys}
            )
            if len(all_years) < 2:
                continue
            span = max(all_years) - min(all_years)
            if surname in COMMON_LASTNAMES and span > COMMON_SURNAME_MAX_SPAN:
                continue
            sids   = list(sid_year_map.keys())
            anchor = sids[0]
            for other in sids[1:]:
                uf.union(anchor, other,
                         evidence=("tier2_same_boat_multi_year",
                                   surname, boat_id, sorted(all_years)))
                tier2_links += 1

    print(f"  Step D (Tier 2): {tier2_links} multi-year same-boat links",
          flush=True)

    # ---- Step E: Tier 3 ------------------------------------------------
    club_surname = defaultdict(list)
    for cid, s in canon_info.items():
        club_n = (s["club_normalized"] or "").strip()
        if not club_n:
            continue
        for _disp, ln_norm in expanded.get(cid, []):
            if not is_valid_surname(ln_norm):
                continue
            if ln_norm in COMMON_LASTNAMES:
                continue
            club_surname[(club_n, ln_norm)].append(cid)

    tier3_links = 0
    for (club_n, surname), sids in club_surname.items():
        uniq = list(set(sids))
        if len(uniq) < 2:
            continue
        anchor = uniq[0]
        for other in uniq[1:]:
            uf.union(anchor, other,
                     evidence=("tier3_same_club_surname", surname, club_n))
            tier3_links += 1

    print(f"  Step E (Tier 3): {tier3_links} same-club/same-surname links",
          flush=True)

    # ---- Step F: write families ----------------------------------------
    groups = uf.groups()
    print(f"\nGroupings: {len(groups)} "
          f"(will filter to families with >=2 canonical sailors)", flush=True)

    canon_regattas = defaultdict(set)
    canon_boats    = defaultdict(set)
    canon_years    = defaultdict(set)
    for p in canon_parts:
        canon_regattas[p["sailor_id"]].add(p["regatta_id"])
        if p["boat_id"] is not None:
            canon_boats[p["sailor_id"]].add(p["boat_id"])
        yr = regatta_year.get(p["regatta_id"])
        if yr:
            canon_years[p["sailor_id"]].add(yr)

    cur.execute("BEGIN")
    next_family_id   = 1
    families_written = 0
    skipped_bad_surname = 0
    skipped_span        = 0

    for root, member_cids in sorted(groups.items()):
        if len(member_cids) < 2:
            continue

        surname_counts = defaultdict(int)
        for cid in member_cids:
            for _disp, ln_norm in expanded.get(cid, []):
                if is_valid_surname(ln_norm):
                    surname_counts[ln_norm] += 1
        if not surname_counts:
            skipped_bad_surname += 1
            continue
        surname = max(surname_counts.items(), key=lambda kv: kv[1])[0]

        member_regattas = set()
        member_boats    = set()
        member_years    = set()
        for cid in member_cids:
            member_regattas |= canon_regattas.get(cid, set())
            member_boats    |= canon_boats.get(cid, set())
            member_years    |= clamp_years(canon_years.get(cid, set()))

        year_span = (max(member_years) - min(member_years)) if member_years else None

        # Filter implausible spans
        if year_span is not None and year_span > 60:
            skipped_span += 1
            continue

        # Common surnames: cap both span and sailor count
        if surname in COMMON_LASTNAMES:
            if year_span is not None and year_span > COMMON_SURNAME_MAX_SPAN:
                skipped_span += 1
                continue
            if len(member_cids) > COMMON_SURNAME_MAX_SAILORS:
                skipped_span += 1
                continue

        kinds = {e[0] for e in uf.evidence.get(root, [])}

        if "tier2_same_boat_multi_year" in kinds:
            confidence = "high" if len(member_cids) >= 3 else "medium"
        elif "tier1_same_boat_regatta" in kinds:
            confidence = "high" if len(member_cids) >= 3 else "medium"
        elif "tier3_same_club_surname" in kinds:
            confidence = "low"
        else:
            confidence = "low"

        evidence_str = "; ".join(sorted(kinds))

        cur.execute("""
            INSERT INTO families (id, surname, sailor_count, regatta_count,
                boat_count, year_span, confidence, evidence)
            VALUES (?,?,?,?,?,?,?,?)
        """, (next_family_id, surname.title(), len(member_cids),
              len(member_regattas), len(member_boats), year_span,
              confidence, evidence_str))

        for cid in member_cids:
            cur.execute("""
                UPDATE sailors SET family_id = ?
                WHERE id IN (
                    SELECT sailor_id FROM sailor_alias WHERE canonical_id = ?
                )
            """, (next_family_id, cid))

        next_family_id  += 1
        families_written += 1

    con.commit()
    con.close()

    elapsed = time.time() - started
    print(f"\nWrote {families_written:,} families in {elapsed:.1f}s")
    print(f"Skipped: {skipped_bad_surname} bad surnames, "
          f"{skipped_span} implausible spans")


if __name__ == "__main__":
    main()