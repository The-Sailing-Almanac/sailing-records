import { logger } from "@stax/logger";
import { Pool } from "pg";
import crypto from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function normalizeUrl(rawUrl: string): Promise<string> {
  try {
    const urlObj = new URL(rawUrl);
    // Remove tracking parameters
    const paramsToDelete = [];
    for (const key of urlObj.searchParams.keys()) {
      if (key.startsWith("utm_") || key === "ref" || key === "source") {
        paramsToDelete.push(key);
      }
    }
    for (const key of paramsToDelete) {
      urlObj.searchParams.delete(key);
    }
    // Remove trailing slash
    let cleanUrl = urlObj.toString();
    if (cleanUrl.endsWith("/")) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    return cleanUrl;
  } catch (error) {
    logger.error("Invalid URL:", rawUrl);
    return rawUrl;
  }
}

export function generateUrlHash(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex");
}

export async function isUrlDiscovered(urlHash: string): Promise<boolean> {
  const res = await dbPool.query(
    "SELECT 1 FROM article_links WHERE url_hash = $1",
    [urlHash]
  );
  return (res.rowCount || 0) > 0;
}

export async function generateSemanticEmbedding(text: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    logger.error("Failed to generate embedding:", error);
    return [];
  }
}
