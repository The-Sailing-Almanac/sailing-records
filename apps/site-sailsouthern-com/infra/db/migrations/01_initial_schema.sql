-- Initial Database Schema for Sailing Almanac

-- 1. Language Seeding Table
CREATE TABLE IF NOT EXISTS languages (
    id SERIAL PRIMARY KEY,
    language_name VARCHAR(100) NOT NULL,
    native_name VARCHAR(100) NOT NULL,
    suggested_title VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Ingestion & Crawler Infrastructure Tables
CREATE TABLE IF NOT EXISTS source_families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    base_relevance_weight DOUBLE PRECISION DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_family_id UUID REFERENCES source_families(id) ON DELETE SET NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    relevance_score DOUBLE PRECISION DEFAULT 1.0,
    manual_priority_boost INTEGER DEFAULT 0,
    manual_suppression_flag BOOLEAN DEFAULT FALSE,
    crawl_frequency_tier VARCHAR(50) DEFAULT 'daily',
    archive_priority VARCHAR(50) DEFAULT 'normal',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feed_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    format VARCHAR(50) DEFAULT 'rss',
    last_polled_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS article_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url_hash VARCHAR(64) UNIQUE NOT NULL,
    canonical_url TEXT NOT NULL,
    title VARCHAR(255) NOT NULL,
    dek TEXT,
    author VARCHAR(255),
    publisher_name VARCHAR(255),
    published_at TIMESTAMP WITH TIME ZONE,
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    language VARCHAR(10) DEFAULT 'en',
    region_guess VARCHAR(100),
    body_of_water VARCHAR(100),
    relevance_score DOUBLE PRECISION DEFAULT 1.0,
    negative_flags JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    user_flags JSONB DEFAULT '{}'::jsonb,
    archive_status VARCHAR(50) DEFAULT 'pending',
    moderation_state VARCHAR(50) DEFAULT 'received',
    extracted_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_article_links_published_at ON article_links(published_at);
CREATE INDEX IF NOT EXISTS idx_article_links_moderation_state ON article_links(moderation_state);

CREATE TABLE IF NOT EXISTS rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type VARCHAR(50) NOT NULL,
    target_id UUID,
    rule_name VARCHAR(100) NOT NULL,
    rule_value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppression_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type VARCHAR(50) NOT NULL, -- 'global', 'source_family', 'source'
    target_id UUID,
    pattern_type VARCHAR(50) NOT NULL, -- 'url_regex', 'title_regex', 'body_regex'
    pattern TEXT NOT NULL,
    action VARCHAR(50) DEFAULT 'suppress',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evidence_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    log_type VARCHAR(100) NOT NULL, -- 'crawl_failure', 'relevance_boost', 'manual_adjustment'
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- 3. Entity Graph Tables (Aligned with sailing-records SQLite Schema)

CREATE TABLE IF NOT EXISTS families (
    id SERIAL PRIMARY KEY,
    surname VARCHAR(100) UNIQUE NOT NULL,
    sailor_count INTEGER DEFAULT 0,
    regatta_count INTEGER DEFAULT 0,
    boat_count INTEGER DEFAULT 0,
    year_span INTEGER DEFAULT 0,
    confidence VARCHAR(50) DEFAULT 'medium',
    evidence TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sailors (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    world_sailing_id VARCHAR(100) UNIQUE,
    us_sailing_id VARCHAR(100) UNIQUE,
    club TEXT,
    club_normalized TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    match_confidence VARCHAR(50),
    name_normalized VARCHAR(255),
    family_id INTEGER REFERENCES families(id) ON DELETE SET NULL,
    slug VARCHAR(255),
    parsed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sailors_ws ON sailors(world_sailing_id) WHERE world_sailing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sailors_us ON sailors(us_sailing_id) WHERE us_sailing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sailors_name_normalized ON sailors(name_normalized);

CREATE TABLE IF NOT EXISTS sailor_alias (
    sailor_id INTEGER PRIMARY KEY REFERENCES sailors(id) ON DELETE CASCADE,
    canonical_id INTEGER REFERENCES sailors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS regattas (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(255) NOT NULL,
    start_date DATE,
    end_date DATE,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    platform VARCHAR(100), -- 'YachtScoring', 'ICSA', 'RegattaNetwork', 'Clubspot'
    is_completed BOOLEAN DEFAULT FALSE,
    raw_event_url TEXT,
    parsed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cs_regatta_id VARCHAR(100),
    rn_regatta_id INTEGER
);

CREATE TABLE IF NOT EXISTS boats (
    id SERIAL PRIMARY KEY,
    yacht_scoring_boat_id VARCHAR(100) UNIQUE,
    name VARCHAR(255) NOT NULL,
    design VARCHAR(255), -- Class/design name
    length DOUBLE PRECISION,
    first_seen_event_id INTEGER REFERENCES regattas(id) ON DELETE SET NULL,
    parsed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cs_sail_number VARCHAR(100),
    rn_sail_number VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_boats_name ON boats(name);

CREATE TABLE IF NOT EXISTS participation (
    id SERIAL PRIMARY KEY,
    sailor_id INTEGER REFERENCES sailors(id) ON DELETE CASCADE,
    boat_id INTEGER REFERENCES boats(id) ON DELETE CASCADE,
    regatta_id INTEGER REFERENCES regattas(id) ON DELETE CASCADE,
    role VARCHAR(100), -- 'owner', 'skipper', 'crew', 'tactician'
    cs_class_name VARCHAR(100),
    school VARCHAR(100),
    division VARCHAR(100),
    graduation_year INTEGER,
    race_range VARCHAR(100),
    UNIQUE(sailor_id, boat_id, regatta_id, role)
);

CREATE TABLE IF NOT EXISTS race_results (
    id SERIAL PRIMARY KEY,
    regatta_id INTEGER REFERENCES regattas(id) ON DELETE CASCADE,
    boat_id INTEGER REFERENCES boats(id) ON DELETE CASCADE,
    class_name VARCHAR(100),
    division_name VARCHAR(100),
    circle_name VARCHAR(100),
    race_number INTEGER,
    finish_status VARCHAR(50), -- 'FIN', 'DNF', 'DNS', 'OCS'
    race_value DOUBLE PRECISION,
    sort_value DOUBLE PRECISION,
    UNIQUE(regatta_id, boat_id, race_number)
);


-- 4. Entity-Mentions mapping table (joins article links to the entity graph nodes)
CREATE TABLE IF NOT EXISTS entity_mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_link_id UUID REFERENCES article_links(id) ON DELETE CASCADE,
    entity_type VARCHAR(100) NOT NULL, -- 'sailor', 'boat', 'regatta', 'class', 'location'
    entity_id INTEGER NOT NULL, -- Maps to primary key id of sailors/boats/regattas tables
    matched_text VARCHAR(255) NOT NULL,
    confidence_score DOUBLE PRECISION DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entity_mentions_article ON entity_mentions(article_link_id);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_mapping ON entity_mentions(entity_type, entity_id);
