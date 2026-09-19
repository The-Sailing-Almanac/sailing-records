-- Sprint 6: article_links quality and enrichment columns

ALTER TABLE article_links
  ADD COLUMN IF NOT EXISTS quality_score DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS is_suppressed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suppression_reason TEXT,
  ADD COLUMN IF NOT EXISTS http_status INTEGER,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS source_family_id UUID REFERENCES source_families(id) ON DELETE SET NULL;

-- relevance_score already exists; allow NULL for unscored rows
ALTER TABLE article_links ALTER COLUMN relevance_score DROP DEFAULT;
ALTER TABLE article_links ALTER COLUMN relevance_score DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_article_links_domain ON article_links(domain);
CREATE INDEX IF NOT EXISTS idx_article_links_relevance_score ON article_links(relevance_score);
CREATE INDEX IF NOT EXISTS idx_article_links_is_suppressed ON article_links(is_suppressed) WHERE is_suppressed = TRUE;
CREATE INDEX IF NOT EXISTS idx_article_links_source_family_id ON article_links(source_family_id);
