import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });

interface SitemapUrl {
  loc: string;
  lastmod?: string;
}

interface ParseResult {
  type: "urlset" | "index";
  urls: SitemapUrl[];
  sitemaps: string[];
}

export function parseSitemap(xml: string): ParseResult {
  const doc = parser.parse(xml);

  if (doc.sitemapindex) {
    const raw = doc.sitemapindex.sitemap;
    const sitemaps = (Array.isArray(raw) ? raw : [raw])
      .map((s: any) => s?.loc)
      .filter(Boolean);
    return { type: "index", urls: [], sitemaps };
  }

  if (doc.urlset) {
    const raw = doc.urlset.url;
    const urls = (Array.isArray(raw) ? raw : [raw])
      .map((u: any) => ({ loc: String(u?.loc), lastmod: u?.lastmod }))
      .filter((u): u is { loc: string; lastmod: string | undefined } => typeof u.loc === "string" && u.loc !== "undefined") as SitemapUrl[];
    return { type: "urlset", urls, sitemaps: [] };
  }

  return { type: "urlset", urls: [], sitemaps: [] };
}

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "SailingAlmanac-Crawler/1.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Sitemap fetch failed ${res.status}: ${url}`);
  return res.text();
}

export async function discoverUrls(
  domain: string,
  sitemapUrls: string[],
  maxDepth = 2
): Promise<string[]> {
  const collected: string[] = [];

  async function crawl(url: string, depth: number) {
    if (depth > maxDepth) return;
    try {
      const xml = await fetchXml(url);
      const result = parseSitemap(xml);
      if (result.type === "index") {
        for (const child of result.sitemaps) {
          await crawl(child, depth + 1);
        }
      } else {
        collected.push(...result.urls.map(u => u.loc));
      }
    } catch {
      // non-fatal
    }
  }

  for (const url of sitemapUrls) {
    await crawl(url, 0);
  }

  return collected;
}

export function buildSitemapUrls(domain: string): string[] {
  return [
    `https://${domain}/news-sitemap.xml`,
    `https://${domain}/sitemap.xml`,
    `https://${domain}/sitemap_index.xml`,
    `https://www.${domain}/news-sitemap.xml`,
    `https://www.${domain}/sitemap.xml`,
  ];
}
