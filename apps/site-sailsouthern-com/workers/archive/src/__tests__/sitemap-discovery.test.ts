import { describe, it, expect, vi } from "vitest";
import { parseSitemap, discoverUrls } from "../sitemap-discovery.js";

const NEWS_SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>https://sailingworld.com/race/j70-worlds-2025/</loc>
    <lastmod>2025-06-15</lastmod>
    <news:news>
      <news:publication_date>2025-06-15T09:00:00Z</news:publication_date>
    </news:news>
  </url>
  <url>
    <loc>https://sailingworld.com/gear/new-sails-review/</loc>
    <lastmod>2025-06-14</lastmod>
  </url>
</urlset>`;

const SITEMAP_INDEX_XML = `<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://sailingworld.com/news-sitemap.xml</loc></sitemap>
  <sitemap><loc>https://sailingworld.com/sitemap-2025.xml</loc></sitemap>
</sitemapindex>`;

describe("parseSitemap", () => {
  it("extracts URLs from a news sitemap", () => {
    const result = parseSitemap(NEWS_SITEMAP_XML);
    expect(result.type).toBe("urlset");
    expect(result.urls).toHaveLength(2);
    expect(result.urls[0].loc).toBe("https://sailingworld.com/race/j70-worlds-2025/");
    expect(result.urls[0].lastmod).toBe("2025-06-15");
  });

  it("detects sitemap index", () => {
    const result = parseSitemap(SITEMAP_INDEX_XML);
    expect(result.type).toBe("index");
    expect(result.sitemaps).toHaveLength(2);
  });
});

describe("discoverUrls", () => {
  it("returns URLs from a news sitemap", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => NEWS_SITEMAP_XML,
    });
    global.fetch = fakeFetch as any;
    const urls = await discoverUrls("sailingworld.com", ["https://sailingworld.com/news-sitemap.xml"]);
    expect(urls.length).toBe(2);
    expect(urls[0]).toBe("https://sailingworld.com/race/j70-worlds-2025/");
  });

  it("follows sitemap index and collects child URLs", async () => {
    const fakeFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => SITEMAP_INDEX_XML })
      .mockResolvedValue({ ok: true, text: async () => NEWS_SITEMAP_XML });
    global.fetch = fakeFetch as any;
    const urls = await discoverUrls("sailingworld.com", ["https://sailingworld.com/sitemap.xml"]);
    expect(urls.length).toBe(4);
  });
});
