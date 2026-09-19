-- Sprint 9A: OG Image extraction column
-- Scraped during ingest enrichment, stored for use in news cards and newsletters

ALTER TABLE article_links
  ADD COLUMN IF NOT EXISTS og_image_url     TEXT,
  ADD COLUMN IF NOT EXISTS og_image_scraped_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_article_links_og_image ON article_links(og_image_url) WHERE og_image_url IS NOT NULL;
