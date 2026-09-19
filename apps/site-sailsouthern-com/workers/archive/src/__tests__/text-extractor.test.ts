import { describe, it, expect } from "vitest";
import { extractArticle } from "../text-extractor.js";

const FULL_ARTICLE_HTML = `
<html>
<head>
  <title>J/70 Worlds Day 3</title>
  <meta property="og:description" content="Day three of the J/70 World Championship." />
  <meta property="og:image" content="https://example.com/img.jpg" />
  <script type="application/ld+json">
    {"@type":"NewsArticle","datePublished":"2025-06-15T09:00:00Z","author":{"name":"Jane Doe"}}
  </script>
</head>
<body>
  <nav>Nav links here</nav>
  <article>
    <h1>J/70 Worlds Day 3</h1>
    <p>Racing continued today with strong winds from the southwest.</p>
    <p>The American team extended their lead after three races.</p>
  </article>
  <footer>Footer content</footer>
</body>
</html>`;

const PAYWALLED_HTML = `
<html><body>
  <script type="application/ld+json">{"isAccessibleForFree":"False"}</script>
  <article><p>Subscribe to read this article.</p></article>
</body></html>`;

describe("extractArticle", () => {
  it("extracts title from og:title or <title>", () => {
    const result = extractArticle(FULL_ARTICLE_HTML, "https://example.com/article");
    expect(result.title).toBe("J/70 Worlds Day 3");
  });

  it("extracts body text from <article> element", () => {
    const result = extractArticle(FULL_ARTICLE_HTML, "https://example.com/article");
    expect(result.text_extracted).toContain("Racing continued today");
    expect(result.text_extracted).not.toContain("Nav links");
    expect(result.text_extracted).not.toContain("Footer content");
  });

  it("extracts published_at from schema.org JSON-LD", () => {
    const result = extractArticle(FULL_ARTICLE_HTML, "https://example.com/article");
    expect(result.published_at).toBe("2025-06-15T09:00:00Z");
  });

  it("extracts author from schema.org", () => {
    const result = extractArticle(FULL_ARTICLE_HTML, "https://example.com/article");
    expect(result.author).toBe("Jane Doe");
  });

  it("extracts og:image", () => {
    const result = extractArticle(FULL_ARTICLE_HTML, "https://example.com/article");
    expect(result.og_image).toBe("https://example.com/img.jpg");
  });

  it("detects paywalled content via schema.org isAccessibleForFree", () => {
    const result = extractArticle(PAYWALLED_HTML, "https://example.com/locked");
    expect(result.is_paywalled).toBe(true);
  });

  it("detects paywalled content by short word count", () => {
    const shortHtml = `<html><body><article><p>Subscribe to read more.</p></article></body></html>`;
    const result = extractArticle(shortHtml, "https://example.com/locked");
    expect(result.is_paywalled).toBe(true);
  });

  it("counts words in extracted text", () => {
    const result = extractArticle(FULL_ARTICLE_HTML, "https://example.com/article");
    expect(result.word_count).toBeGreaterThan(10);
  });
});
