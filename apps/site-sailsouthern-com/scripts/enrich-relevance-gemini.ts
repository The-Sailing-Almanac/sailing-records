/**
 * Script: enrich-relevance-gemini.ts
 * Purpose: Operational run script.
 * Idempotent: Yes
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import { pool, closePool } from "./lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { broadcastAlert } from "./lib/notifications";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[enrich-relevance-gemini] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const BATCH_SIZE = 50;
let DAILY_CAP_LIMIT = 10000; // Hard cap of 10,000 calls per day

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scoreBatchWithGemini(
  articles: Array<{ id: string; title: string; canonical_url: string; snippet: string }>,
  modelName: string,
  critiquesText: string
) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json" },
  });

  const articlesText = articles.map(a =>
    `ID: ${a.id}\nTitle: ${a.title}\nURL: ${a.canonical_url}\nSnippet: ${a.snippet || "No snippet"}\n`
  ).join("\n---\n");

  const prompt = `
You are an expert content analyzer for "Sailing Almanac".
Evaluate the relevance of each of the following articles to the following sailing/nautical topics:
- Sailing, sailboat racing, regattas, yachting, and sailboat cruising.
- Sailing community news, yacht club dispatches, windsurfing, kiteboarding, and boat building/design of sailboats.
- Nautical heritage, maritime history, ocean/coastal racing, marine weather for sailing.

Score each article strictly in the range of 0.1 to 0.7:
- Score 0.1: Completely unrelated. General sports, politics, general technology, unrelated cruise lines, generic travel/tourism, general news, finance, lifestyle, spam.
- Score 0.2 - 0.4: Weakly/indirectly related. General powerboating, commercial shipping, general oceanography, coastal tourism, general fishing, generic marine industry news.
- Score 0.5 - 0.7: Strongly related. Sailboat racing, regattas, sailing cruising, yacht clubs, sailing gear, sailboat maintenance/design, windsurfing, ILCA/Laser/Optimist racing.

${critiquesText ? `
### Evolving Guidelines (Based on Past Human Corrections):
Below is a list of corrections and criticisms submitted by the human operator. You MUST adjust your scoring patterns to align with these guidelines:
${critiquesText}
` : ''}

Articles to evaluate:
${articlesText}

Respond ONLY with a JSON object of this structure:
{
  "results": [
    {
      "id": "article-uuid",
      "score": 0.5,
      "reason": "brief reason"
    }
  ]
}
`;

  let attempt = 0;
  const maxAttempts = 5;
  let delay = 10000; // start with 10s delay

  while (attempt < maxAttempts) {
    try {
      const aiRes = await model.generateContent(prompt);
      const text = aiRes.response.text();
      const parsed = JSON.parse(text);
      return parsed.results || [];
    } catch (error: any) {
      attempt++;
      console.warn(`[Gemini API Error] Attempt ${attempt}/${maxAttempts} failed: ${error.message || error}`);
      if (error.status === 429 || error.message?.includes("429") || error.message?.includes("Quota")) {
        console.log(`[Rate Limit] Hit quota limit. Sleeping for ${delay / 1000}s before retry...`);
        await sleep(delay);
        delay *= 2; // exponential backoff
      } else {
        // For non-rate-limit errors, wait a bit and retry
        await sleep(5000);
      }
    }
  }
  return [];
}

const CURRENT_SCORER_VERSION = 2;

async function run() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  // Load processing controls from database
  let controls = {
    max_items_per_run: 2000,
    daily_cap: 10000,
    pause_historical: false,
    low_spend_mode: false,
  };
  try {
    const controlsRes = await pool.query(
      `SELECT max_items_per_run, daily_cap, pause_historical, low_spend_mode 
       FROM processing_controls 
       WHERE id = 'default'`
    );
    if (controlsRes.rows[0]) {
      controls = controlsRes.rows[0];
      DAILY_CAP_LIMIT = controls.daily_cap;
      console.log("[Relevance Enrichment] Loaded dynamic controls:", controls);
    }
  } catch (err) {
    console.warn("[Relevance Enrichment Warning] Failed to load processing controls, using defaults:", err);
  }

  const limitIndex = args.indexOf("--limit");
  const limitArg = limitIndex !== -1 ? args[limitIndex + 1] : args.find(arg => arg.startsWith("--limit="))?.split("=")[1];
  let limit = limitArg ? parseInt(limitArg, 10) : controls.max_items_per_run;

  const modelIndex = args.indexOf("--model");
  const modelArg = modelIndex !== -1 ? args[modelIndex + 1] : args.find(arg => arg.startsWith("--model="))?.split("=")[1];
  let modelName = modelArg ?? "gemini-2.5-flash-lite";

  if (controls.low_spend_mode) {
    console.log("[Relevance Enrichment] [Low Spend Mode] Active. Enforcing gemini-2.5-flash-lite and limiting run items to max 200.");
    modelName = "gemini-2.5-flash-lite";
    limit = Math.min(limit, 200);
  }

  console.log(`[Relevance Enrichment] Starting. Model: ${modelName}. Limit: ${limit}. Dry Run: ${dryRun}`);

  // 1. Daily Cap Guard
  let dailyCallsMade = 0;
  try {
    const usageRes = await pool.query(
      `SELECT SUM(calls_made)::int AS total_calls FROM gemini_usage_log WHERE run_date = CURRENT_DATE`
    );
    dailyCallsMade = usageRes.rows[0]?.total_calls || 0;
    console.log(`[Cost Control] Gemini API calls made today so far: ${dailyCallsMade}`);
    
    if (dailyCallsMade >= DAILY_CAP_LIMIT) {
      console.warn(`[Cost Control] Hard cap limit of ${DAILY_CAP_LIMIT} calls reached today. Aborting run.`);
      await broadcastAlert({
        title: "⚠️ Cost Control Cap Active",
        text: `Gemini backfill skipped. Daily limit of ${DAILY_CAP_LIMIT} calls is active (made ${dailyCallsMade} calls today).`,
        color: "FF5F1F"
      });
      await closePool();
      return;
    }
  } catch (err) {
    console.warn("[Cost Control Warning] Failed to fetch usage log stats:", err);
  }

  // 2. Fetch critiques
  let critiquesText = "";
  try {
    const critiquesRes = await pool.query<{
      title: string;
      canonical_url: string;
      relevance_score: number;
      critique: string;
    }>(
      `SELECT title, canonical_url, relevance_score, metadata->>'critique' as critique
       FROM article_links
       WHERE metadata->>'critique_processed' = 'true'
         AND metadata->>'critique' IS NOT NULL
       ORDER BY relevance_checked_at DESC
       LIMIT 50`
    );
    if (critiquesRes.rows.length > 0) {
      critiquesText = critiquesRes.rows.map(c => 
        `- Article: "${c.title}" (URL: ${c.canonical_url})\n  Human Corrected Score: ${c.relevance_score}\n  Operator Criticism: "${c.critique}"`
      ).join("\n\n");
      console.log(`[Relevance Enrichment] Loaded ${critiquesRes.rows.length} past human critiques for learning context.`);
    }
  } catch (err) {
    console.warn("[Relevance Enrichment Warning] Failed to load human critiques:", err);
  }

  // 3. Process batches up to limit
  let totalProcessed = 0;
  let geminiCalls = 0;
  const maxBatches = Math.ceil(limit / BATCH_SIZE);

  await broadcastAlert({
    title: "🧠 Relevance Scorer Activated",
    text: `Relevance scoring service started.\nScorer Version: v${CURRENT_SCORER_VERSION}\nModel: \`${modelName}\`\nLimit Target: ${limit} (batches: ${maxBatches})`,
    color: "3498DB"
  });

  for (let batchNum = 1; batchNum <= maxBatches; batchNum++) {
    // Check daily cap limit dynamically within the loop
    if (dailyCallsMade + geminiCalls >= DAILY_CAP_LIMIT) {
      console.warn(`[Cost Control] Daily cap limit of ${DAILY_CAP_LIMIT} reached mid-run. Stopping further batches.`);
      break;
    }

    const remainingToFetch = Math.min(BATCH_SIZE, limit - totalProcessed);
    if (remainingToFetch <= 0) break;

    const res = await pool.query<{
      id: string;
      title: string;
      canonical_url: string;
      content_snippet: string;
    }>(
      `SELECT id, title, canonical_url, content_snippet
       FROM article_links
       WHERE (relevance_version IS NULL OR relevance_version < $1) AND is_suppressed = false
         ${controls.pause_historical ? "AND processing_lane = 'current'" : ""}
       ORDER BY id
       LIMIT $2`,
      [CURRENT_SCORER_VERSION, remainingToFetch]
    );

    if (res.rows.length === 0) {
      console.log("[Relevance Enrichment] No more low-relevance articles to process.");
      break;
    }

    const batch = res.rows.map(r => ({
      id: r.id,
      title: r.title || "",
      canonical_url: r.canonical_url || "",
      snippet: r.content_snippet || ""
    }));

    console.log(`[Relevance Enrichment] Batch ${batchNum}/${maxBatches}: evaluating ${batch.length} articles...`);
    
    geminiCalls++;
    let results: any[] = [];
    if (!dryRun) {
      results = await scoreBatchWithGemini(batch, modelName, critiquesText);
    } else {
      // Dry run simulation
      results = batch.map(b => ({ id: b.id, score: 0.1, reason: "dry run" }));
    }

    if (results.length === 0) {
      console.log(`[Relevance Enrichment] Batch ${batchNum} returned 0 results. Skipping updates.`);
      continue;
    }

    const ids: string[] = [];
    const scores: number[] = [];

    for (const item of results) {
      if (item.id && typeof item.score === "number") {
        ids.push(item.id);
        const clampedScore = Math.max(0.1, Math.min(0.7, item.score));
        scores.push(clampedScore);
      }
    }

    if (ids.length > 0 && !dryRun) {
      await pool.query(
        `UPDATE article_links AS a
         SET relevance_score = v.score,
             relevance_version = $3,
             relevance_checked_at = NOW()
         FROM (
           SELECT unnest($1::uuid[]) AS id, unnest($2::float8[]) AS score
         ) v
         WHERE a.id = v.id`,
        [ids, scores, CURRENT_SCORER_VERSION]
      );
      totalProcessed += ids.length;
      console.log(`[Relevance Enrichment] Batch ${batchNum} updated ${ids.length} articles.`);
    } else if (dryRun) {
      totalProcessed += ids.length;
    }

    if (batchNum < maxBatches) {
      await sleep(1000); // 1s sleep between batches
    }
  }

  // 4. Log costs and update usage database
  // gemini-2.5-flash-lite costs: $0.075 per 1M input, $0.30 per 1M output
  // We approximate $0.000027 per article evaluated
  const costPerArticle = modelName.includes("lite") ? 0.000027 : 0.0001;
  const estimatedCost = totalProcessed * costPerArticle;
  
  console.log(`[Cost Control] Per-run cost estimate: $${estimatedCost.toFixed(5)} USD for ${totalProcessed} articles evaluated.`);

  if (!dryRun && geminiCalls > 0) {
    try {
      await pool.query(
        `INSERT INTO gemini_usage_log (run_date, model, calls_made, estimated_cost_usd)
         VALUES (CURRENT_DATE, $1, $2, $3)
         ON CONFLICT (run_date, model) 
         DO UPDATE SET 
           calls_made = gemini_usage_log.calls_made + EXCLUDED.calls_made,
           estimated_cost_usd = gemini_usage_log.estimated_cost_usd + EXCLUDED.estimated_cost_usd`,
        [modelName, geminiCalls, estimatedCost]
      );
      console.log("[Cost Control] Usage log updated successfully.");
    } catch (err) {
      console.error("[Cost Control Error] Failed to write usage to database:", err);
    }
  }

  console.log(`[Relevance Enrichment] Finished. Evaluated ${totalProcessed} articles.`);

  await broadcastAlert({
    title: "🧠 Relevance Scorer Heartbeat",
    text: `Relevance scoring completed sweep. Dry Run: ${dryRun}.`,
    fields: [
      { name: "Total Articles Scored", value: `${totalProcessed}`, inline: true },
      { name: "Gemini Calls Made", value: `${geminiCalls}`, inline: true },
      { name: "Estimated Cost", value: `$${estimatedCost.toFixed(5)} USD`, inline: true },
      { name: "Model Employed", value: `\`${modelName}\``, inline: true }
    ],
    color: "39FF14"
  });

  await closePool();
}

run().catch(async (err) => {
  console.error("[Relevance Enrichment] Failed:", err);
  await broadcastAlert({
    title: "🚨 Relevance Scorer CRITICAL FAILURE",
    text: `Relevance scorer worker crashed with the following error:\n\`\`\`\n${err.message || err}\n\`\`\``,
    color: "FF5F1F"
  });
  process.exit(1);
});
