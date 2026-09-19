import * as cheerio from "cheerio";

export interface ExtractedArticle {
  title: string | null;
  author: string | null;
  published_at: string | null;
  text_extracted: string;
  word_count: number;
  og_image: string | null;
  og_description: string | null;
  schema_org: Record<string, unknown>;
  is_paywalled: boolean;
}

const NOISE_SELECTORS = [
  "nav", "header", "footer", "aside", ".sidebar", ".ad", ".advertisement",
  ".newsletter-signup", ".related-articles", "script", "style", "noscript",
];

function parseSchemaOrg(html: string): Record<string, unknown> {
  const $ = cheerio.load(html);
  try {
    const raw = $('script[type="application/ld+json"]').first().text();
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function extractArticle(html: string, url: string): ExtractedArticle {
  const schema = parseSchemaOrg(html);

  // Extract meta/head fields BEFORE removing noise selectors
  const $meta = cheerio.load(html);
  const title =
    $meta('meta[property="og:title"]').attr("content") ||
    $meta("title").text().trim() ||
    (schema.name as string) ||
    null;
  const og_image = $meta('meta[property="og:image"]').attr("content") || null;
  const og_description = $meta('meta[property="og:description"]').attr("content") || null;

  // Now build a clean $ for body text extraction
  const $ = cheerio.load(html);
  NOISE_SELECTORS.forEach(sel => $(sel).remove());

  const bodyEl = $("article").first().length
    ? $("article").first()
    : $("main").first().length
    ? $("main").first()
    : $("body");

  const text_extracted = bodyEl.text().replace(/\s+/g, " ").trim();
  const word_count = text_extracted.split(/\s+/).filter(Boolean).length;

  const authorSchema = schema.author as Record<string, string> | string | undefined;
  const author =
    typeof authorSchema === "string"
      ? authorSchema
      : authorSchema?.name ||
        $meta('meta[name="author"]').attr("content") ||
        null;

  const published_at =
    (schema.datePublished as string) ||
    $meta('meta[property="article:published_time"]').attr("content") ||
    $meta("time[datetime]").first().attr("datetime") ||
    null;

  const accessibleRaw = (schema.isAccessibleForFree as string | undefined)?.toLowerCase();
  const is_paywalled =
    accessibleRaw === "false" ||
    word_count < 150;

  return {
    title,
    author,
    published_at,
    text_extracted,
    word_count,
    og_image,
    og_description,
    schema_org: schema,
    is_paywalled,
  };
}
