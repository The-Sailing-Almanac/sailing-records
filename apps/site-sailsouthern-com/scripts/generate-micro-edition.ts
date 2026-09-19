/**
 * Script: generate-micro-edition.ts
 * Purpose: Generates a canonical micro-newsletter and publishes it across all social rails.
 * Idempotent: Yes
 */
import { pool, closePool } from "./lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { 
  CanonicalMicroNewsletter, 
  renderMastodon, 
  renderNostr, 
  renderBluesky,
  sendGA4Event
} from "@stax/activity-core";
import { 
  publishToMastodon, 
  publishToNostr, 
  publishToBluesky 
} from "./lib/social-adapters";

import { printSection, printOk, printWarn, printFail, printSummary } from "./lib/print";

dotenv.config();

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function appendUtmToLinks(
  links: Array<{ label: string; url: string }>,
  platform: string,
  campaign: string,
  contentTitle: string
): Array<{ label: string; url: string }> {
  return links.map(link => {
    try {
      const urlObj = new URL(link.url);
      urlObj.searchParams.set("utm_source", "sailsouthern");
      urlObj.searchParams.set("utm_medium", platform);
      urlObj.searchParams.set("utm_campaign", campaign);
      urlObj.searchParams.set("utm_content", slugify(contentTitle));
      return { ...link, url: urlObj.toString() };
    } catch {
      return link;
    }
  });
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function generateMicroNewsletterContent(): Promise<{ content: CanonicalMicroNewsletter; articleCount: number } | null> {
  // Fetch top 5 recent high-relevance articles
  const res = await pool.query<{
    title: string;
    canonical_url: string;
    content_snippet: string;
  }>(
    `SELECT title, canonical_url, content_snippet
     FROM article_links
     WHERE created_at > NOW() - INTERVAL '72 hours'
       AND is_suppressed = false
       AND relevance_score >= 0.4
     ORDER BY relevance_score DESC, created_at DESC
     LIMIT 5`
  );

  const articles = res.rows;
  if (articles.length === 0) {
    printWarn("No candidate articles found in the last 72 hours (min relevance 0.4). Skipping generation.");
    printWarn("Next step: check that the ingestion pipeline is running and articles have relevance scores above 0.4.");
    return null;
  }

  const articlesText = articles.map((a, i) =>
    `${i+1}. ${a.title}\nURL: ${a.canonical_url}\nSnippet: ${a.content_snippet || "N/A"}`
  ).join("\n\n");

  const prompt = `
    You are compiling a daily micro-newsletter for "Sailing Almanac" subscribers on social media.
    Please write a brief summary of the most important sailing news using the articles below:

    ${articlesText}

    Output a raw JSON object with the following fields:
    - title: A short, catchy title (e.g. "Sailing Almanac Micro-Digest")
    - summary: A very brief summary of the main news (1-2 sentences, max 180 characters)
    - key_links: An array of up to 2 items containing { label: string, url: string } for the most important stories
    - call_to_action: A short closing text (e.g. "Get details at sailsouthern.com")
    - tags: An array of 2-3 hashtags (e.g. ["sailing", "regatta"])
    
    Ensure your output is valid raw JSON ONLY (no markdown code fences, no extra text).
  `;

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const aiRes = await model.generateContent(prompt);
  const jsonText = aiRes.response.text().trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();

  try {
    const data = JSON.parse(jsonText);
    const content: CanonicalMicroNewsletter = {
      title: data.title || "Sailing Almanac Digest",
      summary: data.summary || "Latest updates from the regatta and gear world.",
      key_links: data.key_links || [],
      call_to_action: data.call_to_action || "Read more on sailsouthern.com",
      tags: data.tags || ["sailing", "newsletter"]
    };

    // Emit GA4 Event for micro edition generation
    await sendGA4Event("micro_edition_generated", {
      title: content.title,
      article_count: articles.length,
      key_links_count: content.key_links.length
    });

    return { content, articleCount: articles.length };
  } catch (err) {
    printFail("Gemini returned invalid JSON — could not parse micro-edition content.", "Try again. If this persists, check GEMINI_API_KEY and the model response log above.");
    console.error("     Raw response:", jsonText);
    return null;
  }
}

export async function generateAndPublishMicroEdition(
  options: { dryRun?: boolean; runId?: number } = {}
): Promise<{ success: boolean; deliveries: number; failures: number }> {
  const isDryRun = options.dryRun ?? false;
  let runId = options.runId;
  const startedAt = Date.now();

  printSection(`Micro-edition publish  ${isDryRun ? "[DRY RUN — no changes will be made]" : "[LIVE]"}  run=${runId ?? "new"}`);
  console.log(`  Started at: ${new Date().toLocaleString()}`);
  if (isDryRun) printWarn("Dry run mode — content will be generated and logged but not published.");

  // Insert run state if runId is not provided
  if (!runId) {
    try {
      const res = await pool.query<{ id: number }>(
        `INSERT INTO social_publishing_runs (job_name, run_status, started_at)
         VALUES ('micro_edition_publish', 'running', NOW())
         RETURNING id`
      );
      runId = res.rows[0].id;
    } catch (dbErr) {
      printFail("Could not create a run record in the database.", "Check DATABASE_URL and that migrations are applied.");
      console.error(dbErr);
    }
  }

  let deliveries = 0;
  let failures = 0;

  try {
    const result = await generateMicroNewsletterContent();
    if (!result) {
      printWarn("No canonical content generated — ending run with 0 deliveries.");
      
      // Update run status to success (with 0 deliveries)
      if (runId) {
        await pool.query(
          `UPDATE social_publishing_runs
           SET run_status = 'success',
               completed_at = NOW(),
               duration_ms = $1,
               summary_counts = $2
           WHERE id = $3`,
          [
            Date.now() - startedAt,
            JSON.stringify({ deliveries: 0, failures: 0, reason: "no_articles" }),
            runId
          ]
        );
      }

      await sendGA4Event("micro_edition_published", {
        deliveries: 0,
        failures: 0,
        reason: "no_articles"
      });

      return { success: true, deliveries: 0, failures: 0 };
    }

    const { content: microNews } = result;

    printSection("Generated micro-edition content");
    console.log(JSON.stringify(microNews, null, 2));

    const campaignId = runId ? `run-${runId}` : `date-${new Date().toISOString().split("T")[0]}`;

    const mastodonNews = {
      ...microNews,
      key_links: appendUtmToLinks(microNews.key_links, "mastodon", campaignId, microNews.title)
    };
    const nostrNews = {
      ...microNews,
      key_links: appendUtmToLinks(microNews.key_links, "nostr", campaignId, microNews.title)
    };
    const blueskyNews = {
      ...microNews,
      key_links: appendUtmToLinks(microNews.key_links, "bluesky", campaignId, microNews.title)
    };

    // Render for each platform
    const mastodonText = renderMastodon(mastodonNews);
    const nostrPayload = renderNostr(nostrNews);
    const blueskyText = renderBluesky(blueskyNews);

    printSection("Platform rendering");
    console.log(`  Mastodon (${mastodonText.length} chars):\n${mastodonText}`);
    console.log(`\n  Nostr (${nostrPayload.content.length} chars):\n${nostrPayload.content}`);
    console.log(`\n  Bluesky (${blueskyText.length} chars):\n${blueskyText}`);

    if (isDryRun) {
      printOk("Dry run complete — content generated, platforms rendered, no posts submitted.");
      
      if (runId) {
        await pool.query(
          `UPDATE social_publishing_runs
           SET run_status = 'success',
               completed_at = NOW(),
               duration_ms = $1,
               summary_counts = $2
           WHERE id = $3`,
          [
            Date.now() - startedAt,
            JSON.stringify({ deliveries: 0, failures: 0, reason: "dry_run" }),
            runId
          ]
        );
      }

      await sendGA4Event("micro_edition_published", {
        deliveries: 0,
        failures: 0,
        reason: "dry_run"
      });

      return { success: true, deliveries: 0, failures: 0 };
    }

    // Query active accounts
    const accs = await pool.query<{ id: number; platform: string }>(
      "SELECT id, platform FROM social_accounts WHERE is_active = true"
    );

    const accountsMap = new Map<string, number>();
    for (const r of accs.rows) {
      accountsMap.set(r.platform, r.id);
    }

    const queryRunner = (sql: string, params?: any[]) => pool.query(sql, params);

    // 1. Publish to Mastodon
    const mastodonAccountId = accountsMap.get("mastodon");
    if (mastodonAccountId) {
      try {
        printSection("Publishing to Mastodon");
        const content = {
          id: `micro-${Date.now()}`,
          type: "newsletter" as const,
          title: microNews.title,
          text: mastodonText,
          links: mastodonNews.key_links.map(l => l.url)
        };
        const res = await publishToMastodon(queryRunner, mastodonAccountId, content);
        printOk(`Published to Mastodon. Post ID: ${res.postId}`);
        deliveries++;

        await sendGA4Event("social_delivery_success", {
          platform: "mastodon",
          post_id: res.postId,
          external_id: res.externalId || ""
        });
      } catch (err: any) {
        printFail(`Mastodon post did not publish: ${err.message}`, "Check MASTODON_INSTANCE_URL and MASTODON_ACCESS_TOKEN in .env.");
        failures++;

        await sendGA4Event("social_delivery_failure", {
          platform: "mastodon",
          error_message: err.message || String(err)
        });
      }
    }

    // 2. Publish to Nostr
    const nostrAccountId = accountsMap.get("nostr");
    if (nostrAccountId) {
      try {
        printSection("Publishing to Nostr");
        const content = {
          id: `micro-${Date.now()}`,
          type: "newsletter" as const,
          title: microNews.title,
          text: nostrPayload.content,
          links: nostrNews.key_links.map(l => l.url)
        };
        const res = await publishToNostr(queryRunner, nostrAccountId, content);
        printOk(`Published to Nostr. Post ID: ${res.postId}`);
        deliveries++;

        await sendGA4Event("social_delivery_success", {
          platform: "nostr",
          post_id: res.postId,
          external_id: res.externalId || ""
        });
      } catch (err: any) {
        printFail(`Nostr post did not publish: ${err.message}`, "Check NOSTR_PRIVATE_KEY in .env and that the relay is reachable.");
        failures++;

        await sendGA4Event("social_delivery_failure", {
          platform: "nostr",
          error_message: err.message || String(err)
        });
      }
    }

    // 3. Publish to Bluesky
    const blueskyAccountId = accountsMap.get("bluesky");
    if (blueskyAccountId) {
      try {
        printSection("Publishing to Bluesky");
        const content = {
          id: `micro-${Date.now()}`,
          type: "newsletter" as const,
          title: microNews.title,
          text: blueskyText,
          links: blueskyNews.key_links.map(l => l.url)
        };
        const res = await publishToBluesky(queryRunner, blueskyAccountId, content);
        printOk(`Published to Bluesky. Post ID: ${res.postId}`);
        deliveries++;

        await sendGA4Event("social_delivery_success", {
          platform: "bluesky",
          post_id: res.postId,
          external_id: res.externalId || ""
        });
      } catch (err: any) {
        printFail(`Bluesky post did not publish: ${err.message}`, "Check BLUESKY_IDENTIFIER and BLUESKY_PASSWORD in .env.");
        failures++;

        await sendGA4Event("social_delivery_failure", {
          platform: "bluesky",
          error_message: err.message || String(err)
        });
      }
    }

    printSection("Run complete");
    if (deliveries > 0) printOk(`Published successfully to ${deliveries} platform${deliveries === 1 ? '' : 's'}.`);
    if (failures > 0)   printFail(`${failures} platform${failures === 1 ? '' : 's'} did not publish. Check the errors above and retry from the dashboard.`);
    if (deliveries === 0 && failures === 0) printWarn("No active social accounts configured. Add accounts via the social_accounts table.");

    const status = failures > 0 && deliveries === 0 ? "failed" : "success";
    if (runId) {
      await pool.query(
        `UPDATE social_publishing_runs
         SET run_status = $1,
             completed_at = NOW(),
             duration_ms = $2,
             summary_counts = $3
         WHERE id = $4`,
        [status, Date.now() - startedAt, JSON.stringify({ deliveries, failures }), runId]
      );
    }

    await sendGA4Event("micro_edition_published", {
      deliveries,
      failures
    });

    return { success: status === "success", deliveries, failures };
  } catch (error: any) {
    printFail(`Publishing run failed unexpectedly: ${error.message || String(error)}`, "Review the stack trace below. If the DB is unreachable, check DATABASE_URL.");
    console.error(error);

    if (runId) {
      try {
        await pool.query(
          `UPDATE social_publishing_runs
           SET run_status = 'failed',
               completed_at = NOW(),
               duration_ms = $1,
               summary_counts = $2,
               error_message = $3
           WHERE id = $4`,
          [Date.now() - startedAt, JSON.stringify({ deliveries, failures }), error.message || String(error), runId]
        );
      } catch (dbErr) {
        printFail("Could not update run status in DB. The run record may be stuck as 'running'.", "Check DATABASE_URL.");
        console.error(dbErr);
      }
    }

    await sendGA4Event("micro_edition_published", {
      deliveries,
      failures,
      error: error.message || String(error)
    });

    return { success: false, deliveries, failures };
  }
}

// Check if run directly via CLI (tsx scripts/generate-micro-edition.ts)
if (process.argv[1] && (process.argv[1].endsWith("generate-micro-edition.ts") || process.argv[1].endsWith("generate-micro-edition.js") || process.argv[1].includes("generate-micro-edition"))) {
  const dryRun = process.argv.includes("--dry-run");
  const runIdIndex = process.argv.indexOf("--run-id");
  const runId = runIdIndex !== -1 ? parseInt(process.argv[runIdIndex + 1], 10) : undefined;
  (async () => {
    try {
      const res = await generateAndPublishMicroEdition({ dryRun, runId });
      printSection(`CLI run finished — success=${res.success} deliveries=${res.deliveries} failures=${res.failures}`);
    } catch (err) {
      printFail("CLI run terminated with an unhandled error.");
      console.error(err);
      process.exit(1);
    } finally {
      await closePool();
    }
  })();
}

