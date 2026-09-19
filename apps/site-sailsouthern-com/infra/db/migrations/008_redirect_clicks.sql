-- Sprint 9A: Redirect click analytics table
-- All outbound links use /r/:hash which records the click here before 302-ing

CREATE TABLE IF NOT EXISTS redirect_clicks (
    id             SERIAL PRIMARY KEY,
    article_link_id UUID REFERENCES article_links(id) ON DELETE CASCADE,
    url_hash       VARCHAR(64) NOT NULL,       -- denorm for fast lookup without join
    subscriber_id  UUID,                        -- NULL for anonymous web visitors
    source         VARCHAR(50) DEFAULT 'web',  -- 'web' | 'newsletter' | 'rss'
    ip_hash        VARCHAR(64),                 -- SHA-256 of remote IP for dedup, never stored raw
    referrer       TEXT,
    clicked_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_redirect_clicks_hash     ON redirect_clicks(url_hash);
CREATE INDEX IF NOT EXISTS idx_redirect_clicks_article  ON redirect_clicks(article_link_id);
CREATE INDEX IF NOT EXISTS idx_redirect_clicks_date     ON redirect_clicks(clicked_at);
