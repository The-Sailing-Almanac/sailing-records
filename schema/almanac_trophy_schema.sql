-- Reference schema for the sailing-almanac trophy/history layer.
-- This is not applied automatically. Use it as the starting point once a pilot
-- club/trophy intake has been selected.

CREATE TABLE IF NOT EXISTS clubs (
    id INTEGER PRIMARY KEY,
    club_name TEXT NOT NULL,
    club_name_normalized TEXT,
    city TEXT,
    state_region TEXT,
    country TEXT,
    website_url TEXT,
    source_url TEXT,
    verified_status TEXT DEFAULT 'unverified',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS trophies (
    id INTEGER PRIMARY KEY,
    club_id INTEGER,
    trophy_name TEXT NOT NULL,
    trophy_name_normalized TEXT,
    award_type TEXT,
    class_name TEXT,
    division_name TEXT,
    first_awarded_year INTEGER,
    description TEXT,
    rules_or_eligibility TEXT,
    source_url TEXT,
    verified_status TEXT DEFAULT 'unverified',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    FOREIGN KEY (club_id) REFERENCES clubs(id)
);

CREATE TABLE IF NOT EXISTS trophy_awards (
    id INTEGER PRIMARY KEY,
    trophy_id INTEGER NOT NULL,
    award_year INTEGER,
    season_label TEXT,
    regatta_id INTEGER,
    boat_id INTEGER,
    sailor_id INTEGER,
    winning_entry_name TEXT,
    winning_club TEXT,
    class_name TEXT,
    division_name TEXT,
    placement INTEGER,
    points_or_score TEXT,
    result_status TEXT DEFAULT 'submitted',
    source_url TEXT,
    source_text_id INTEGER,
    confidence TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    FOREIGN KEY (trophy_id) REFERENCES trophies(id),
    FOREIGN KEY (regatta_id) REFERENCES regattas(id),
    FOREIGN KEY (boat_id) REFERENCES boats(id),
    FOREIGN KEY (sailor_id) REFERENCES sailors(id),
    FOREIGN KEY (source_text_id) REFERENCES source_text(id)
);

CREATE TABLE IF NOT EXISTS trophy_media (
    id INTEGER PRIMARY KEY,
    trophy_id INTEGER NOT NULL,
    trophy_award_id INTEGER,
    media_type TEXT NOT NULL,
    storage_uri TEXT NOT NULL,
    thumbnail_uri TEXT,
    caption TEXT,
    creator TEXT,
    captured_at TEXT,
    rights_status TEXT,
    source_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    FOREIGN KEY (trophy_id) REFERENCES trophies(id),
    FOREIGN KEY (trophy_award_id) REFERENCES trophy_awards(id)
);

CREATE INDEX IF NOT EXISTS idx_clubs_name_norm
    ON clubs(club_name_normalized);

CREATE INDEX IF NOT EXISTS idx_trophies_club
    ON trophies(club_id);

CREATE INDEX IF NOT EXISTS idx_trophy_awards_trophy_year
    ON trophy_awards(trophy_id, award_year);

CREATE INDEX IF NOT EXISTS idx_trophy_awards_regatta
    ON trophy_awards(regatta_id);

CREATE INDEX IF NOT EXISTS idx_trophy_media_trophy
    ON trophy_media(trophy_id);
