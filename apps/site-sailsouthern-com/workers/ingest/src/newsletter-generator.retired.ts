import { logger } from "@stax/logger";
import { Pool } from "pg";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function fetchRecentUrls(edition: "daily" | "weekly"): Promise<Set<string>> {
  const recentNewsletterCount = edition === "weekly" ? 1 : 3;
  const recentNewsletterType = edition === "weekly" ? "Weekly" : "Daily";
  const recentRes = await dbPool.query(
    `SELECT content_md FROM newsletters
     WHERE title ILIKE $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [`%${recentNewsletterType}%`, recentNewsletterCount]
  );

  const recentUrls = new Set<string>();
  for (const row of recentRes.rows) {
    const urlMatches = (row.content_md as string).match(/https?:\/\/[^\s\)\"]+/g) || [];
    urlMatches.forEach(u => recentUrls.add(u));
  }
  return recentUrls;
}

async function fetchCandidateArticles(hours: number, excludeUrls: string[]): Promise<any[]> {
  const excludeClause = excludeUrls.length > 0
    ? `AND url NOT IN (${excludeUrls.map((_, i) => `$${i + 2}`).join(",")})`
    : "";

  const res = await dbPool.query(
    `SELECT title, content_snippet, url, metadata, created_at,
       (1.0 / (1 + EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0)) AS recency_score
     FROM article_links
     WHERE created_at > NOW() - INTERVAL '${hours} hours'
       ${excludeClause}
     ORDER BY recency_score DESC
     LIMIT 30`,
    [hours, ...excludeUrls]
  );
  return res.rows;
}

async function callGeminiToGenerate(edition: "daily" | "weekly", articles: any[]): Promise<string> {
  const articlesText = articles.map(a =>
    `Title: ${a.title}\nSnippet: ${a.content_snippet || "No snippet"}\nURL: ${a.url}\n`
  ).join("\n");

  const weeklyExtra = edition === "weekly"
    ? "Pay special attention to weekend regatta results. If multiple articles cover the same event, merge them into a single section."
    : "";

  const prompt = `
    You are the expert editor-in-chief of "Sailing Almanac", a premium digital newsletter covering the world of sailing, regattas, and boating gear.
    Please write an engaging, editorial-style front-page newsletter summarizing the top news.

    ${weeklyExtra}

    Here are the articles we collected (ordered most recent first):
    ${articlesText}

    Requirements:
    - Write in Markdown format.
    - Start with an exciting hook and a brief editorial introduction.
    - Synthesize the articles into distinct thematic sections (e.g., "Regatta Results", "Gear & Tech", "Cruising Logs", "Podcast Picks").
    - Do not just list articles — weave them into a narrative, but include the source URL for each story so readers can click through.
    - Weight recent articles more heavily in your narrative.
    - End with a brief editorial sign-off.
  `;

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  const aiRes = await model.generateContent(prompt);
  return aiRes.response.text();
}

export async function generateNewsletter(edition: "daily" | "weekly" = "daily") {
  logger.info(`[Newsletter Generator] Starting generation for ${edition} edition...`);
  
  try {
    const hours = edition === "weekly" ? 240 : 72;
    const recentUrls = await fetchRecentUrls(edition);
    const articles = await fetchCandidateArticles(hours, Array.from(recentUrls));

    if (articles.length === 0) {
      logger.info("[Newsletter Generator] No new articles found. Skipping.");
      return;
    }

    logger.info(`[Newsletter Generator] Found ${articles.length} deduplicated articles. Prompting Gemini...`);
    const markdownContent = await callGeminiToGenerate(edition, articles);

    const titleDate = new Date().toISOString().split("T")[0];
    const newsletterTitle = `Sailing Almanac ${edition === "weekly" ? "Weekly" : "Daily"} Digest: ${titleDate}`;

    await dbPool.query(
      `INSERT INTO newsletters (title, content_md, status) VALUES ($1, $2, 'published')`,
      [newsletterTitle, markdownContent]
    );

    logger.info(`[Newsletter Generator] Successfully published: "${newsletterTitle}"`);

  } catch (error) {
    logger.error("[Newsletter Generator Error]", error);
  }
}

// Execute directly: `tsx newsletter-generator.ts [--weekly]`
if (require.main === module) {
  const editionArg = process.argv.includes("--weekly") ? "weekly" : "daily";
  generateNewsletter(editionArg).then(() => process.exit(0));
}
