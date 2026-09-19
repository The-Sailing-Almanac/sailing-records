import * as cheerio from "cheerio";

export interface PaginationPattern {
  type: "page" | "date" | "offset";
  template: string;
  startPage: number;
  maxPages?: number;
}

export async function crawlPaginatedArchive(
  domain: string,
  pattern: PaginationPattern,
  articleSelector: string,
  rateLimitMs: number
): Promise<string[]> {
  const collected: string[] = [];
  const max = pattern.maxPages ?? 500;
  let consecutive404s = 0;

  for (let page = pattern.startPage; page < pattern.startPage + max; page++) {
    const path = pattern.template.replace("{n}", String(page));
    const url = `https://${domain}${path}`;

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "SailingAlmanac-Crawler/1.0" },
        signal: AbortSignal.timeout(15000),
      });

      if (res.status === 404) {
        consecutive404s++;
        if (consecutive404s >= 3) break;
        continue;
      }
      if (!res.ok) continue;

      consecutive404s = 0;
      const html = await res.text();
      const $ = cheerio.load(html);

      const links: string[] = [];
      $(articleSelector).each((_, el) => {
        const href = $(el).attr("href");
        if (href) {
          links.push(href.startsWith("http") ? href : `https://${domain}${href}`);
        }
      });

      if (links.length === 0) break;
      collected.push(...links);

      await new Promise(r => setTimeout(r, rateLimitMs));
    } catch {
      consecutive404s++;
      if (consecutive404s >= 3) break;
    }
  }

  return collected;
}
