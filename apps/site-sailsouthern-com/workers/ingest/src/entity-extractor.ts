import { logger } from "@stax/logger";
/**
 * workers/ingest/src/entity-extractor.ts
 *
 * Sprint 9B — Task B9: Entity Extraction Worker
 *
 * BullMQ worker that consumes the 'entity_extraction' queue,
 * sends article details to Gemini 2.5 Flash to extract named entities,
 * and records those mentions in the entity graph (entities & entity_mentions).
 */

import { Queue, Worker } from "bullmq";
import { Pool } from "pg";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const QUEUE_NAME = "entity_extraction";

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const MODEL_NAME = "gemini-2.5-flash";

export const entityExtractionQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
});

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface ExtractedEntity {
  entity_type: string;
  canonical_name: string;
  mention_text: string;
  confidence: number;
}

/**
 * Uses Gemini to extract entities from article title + snippet.
 */
async function extractEntitiesFromText(
  title: string,
  text: string,
  entityTypes: string[]
): Promise<ExtractedEntity[]> {
  const prompt = `You are a specialized Named Entity Recognition (NER) model for a sailing news knowledgebase.
Given an article title and text snippet, extract mentions of entities belonging to these types:
${entityTypes.join(", ")}

Return ONLY a valid JSON array of objects, with no markdown, markdown code block fences, or other wrapper text. Use the following JSON schema:
[
  {
    "entity_type": "one of the types listed above",
    "canonical_name": "the official/cleanest name of this entity (e.g. 'New York Yacht Club' instead of 'NYYC')",
    "mention_text": "the exact string mentioned in the text",
    "confidence": 0.0 to 1.0
  }
]

Article Title: "${title}"
Article Text: "${text}"`;

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const response = await model.generateContent(prompt);
    const rawText = response.response.text().trim();
    
    // Strip markdown code fences if present
    const cleanedText = rawText.replace(/^```json\n?|^```\n?|\n?```$/gm, "").trim();
    const parsed = JSON.parse(cleanedText);
    
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => 
      item &&
      typeof item.entity_type === "string" &&
      typeof item.canonical_name === "string" &&
      typeof item.mention_text === "string" &&
      typeof item.confidence === "number"
    );
  } catch (err: any) {
    if (err?.status === 429) {
      logger.warn("[EntityExtractor] Gemini API rate limited (429). Propagating to trigger BullMQ retry.");
      throw err;
    }
    logger.error("[EntityExtractor] Failed to extract entities via Gemini:", err);
    return [];
  }
}

async function saveExtractedEntity(
  articleId: string,
  item: ExtractedEntity,
  typeMap: Map<string, number>
): Promise<void> {
  const typeId = typeMap.get(item.entity_type);
  if (!typeId) {
    logger.warn(`[EntityExtractor] Skipping unknown entity type: ${item.entity_type}`);
    return;
  }

  const itemSlug = generateSlug(item.canonical_name);
  if (!itemSlug) return;

  let entityId: number;

  // Check if entity exists by slug, canonical name or aliases
  const existingRes = await dbPool.query(
    `SELECT id FROM entities 
     WHERE slug = $1 
        OR canonical_name ILIKE $2 
        OR $2 = ANY(aliases)`,
    [itemSlug, item.canonical_name]
  );

  if (existingRes.rows[0]) {
    entityId = existingRes.rows[0].id;
  } else {
    // Create new entity (unverified by default)
    const insertEntityRes = await dbPool.query(
      `INSERT INTO entities (entity_type_id, slug, canonical_name, aliases, is_verified)
       VALUES ($1, $2, $3, $4, FALSE)
       ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
       RETURNING id`,
      [typeId, itemSlug, item.canonical_name, [item.canonical_name]]
    );
    entityId = insertEntityRes.rows[0].id;
    logger.info(`[EntityExtractor] Discovered new entity: "${item.canonical_name}" (unverified)`);
  }

  // Insert entity mention link
  await dbPool.query(
    `INSERT INTO entity_mentions (article_id, entity_id, confidence, mention_text)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [articleId, entityId, item.confidence, item.mention_text]
  );
}

/**
 * Process a single entity extraction job.
 */
async function processExtractionJob(articleId: string) {
  logger.info(`[EntityExtractor] Processing article ID: ${articleId}`);

  // 1. Fetch article title and snippet
  const articleRes = await dbPool.query(
    `SELECT title, content_snippet FROM article_links WHERE id = $1`,
    [articleId]
  );
  if (!articleRes.rows[0]) {
    logger.info(`[EntityExtractor] Article ${articleId} not found. Skipping.`);
    return;
  }
  const { title, content_snippet } = articleRes.rows[0];
  const combinedText = (content_snippet || "").slice(0, 800);

  // 2. Fetch known entity types
  const typesRes = await dbPool.query(`SELECT id, slug FROM entity_types`);
  const typeMap = new Map<string, number>(); // slug -> id
  const typeSlugs: string[] = [];
  for (const row of typesRes.rows) {
    typeMap.set(row.slug, row.id);
    typeSlugs.push(row.slug);
  }

  // 3. Extract entities via Gemini
  const extracted = await extractEntitiesFromText(title || "", combinedText, typeSlugs);
  logger.info(`[EntityExtractor] Extracted ${extracted.length} entities for article ${articleId}`);

  // 4. Save to database
  for (const item of extracted) {
    await saveExtractedEntity(articleId, item, typeMap);
  }
}

// ── Define BullMQ worker ──────────────────────────────────────────────────────
export const entityExtractorWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { articleId } = job.data;
    if (!articleId) throw new Error("Missing articleId in job data");
    await processExtractionJob(articleId);
  },
  {
    connection: redisConnection,
    concurrency: 2, // Allow 2 concurrent extractions
    limiter: {
      max: 15,
      duration: 10000, // Limit to 15 jobs per 10 seconds to respect rate limits
    },
  }
);

entityExtractorWorker.on("failed", (job, err) => {
  logger.error(`[EntityExtractor] Job ${job?.id} failed:`, err.message);
});

entityExtractorWorker.on("completed", (job) => {
  logger.info(`[EntityExtractor] Job ${job?.id} completed successfully.`);
});
