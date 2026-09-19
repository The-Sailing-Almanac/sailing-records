-- Sprint 9A: Data quality scoring columns on article_links

ALTER TABLE article_links
  ADD COLUMN IF NOT EXISTS dq_score          DOUBLE PRECISION,   -- 0.0–1.0 composite quality score
  ADD COLUMN IF NOT EXISTS dq_missing_fields TEXT[],             -- array of field names that are NULL/empty
  ADD COLUMN IF NOT EXISTS dq_checked_at     TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_article_links_dq_score ON article_links(dq_score);
