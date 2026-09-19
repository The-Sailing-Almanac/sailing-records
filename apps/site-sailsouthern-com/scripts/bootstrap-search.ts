/**
 * Script: bootstrap-search.ts
 * Purpose: Creates and configures the article_links Meilisearch index.
 * Idempotent: Yes — updates existing Meilisearch settings safely.
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import { meiliClient, ARTICLE_INDEX_UID } from "./lib/meili";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[bootstrap-search] [Dry Run] Would configure Meilisearch settings.");
  process.exit(0);
}

const FILTERABLE = [
  "language",
  "moderation_state",
  "is_suppressed",
  "is_archived",
  "is_flagged",
  "source_family_id",
  "domain",
];

const SORTABLE = ["published_at", "created_at", "relevance_score"];

const SEARCHABLE = ["title", "url", "body_text", "source_name", "domain"];

async function ensureIndex() {
  try {
    await meiliClient.getIndex(ARTICLE_INDEX_UID);
    console.log(`[bootstrap-search] Index "${ARTICLE_INDEX_UID}" exists.`);
  } catch {
    console.log(`[bootstrap-search] Creating index "${ARTICLE_INDEX_UID}"...`);
    const task = await meiliClient.createIndex(ARTICLE_INDEX_UID, {
      primaryKey: "id",
    });
    await meiliClient.waitForTask(task.taskUid);
    console.log(`[bootstrap-search] Index created.`);
  }

  const index = meiliClient.index(ARTICLE_INDEX_UID);

  const filterTask = await index.updateFilterableAttributes(FILTERABLE);
  await meiliClient.waitForTask(filterTask.taskUid);

  const sortTask = await index.updateSortableAttributes(SORTABLE);
  await meiliClient.waitForTask(sortTask.taskUid);

  const searchTask = await index.updateSearchableAttributes(SEARCHABLE);
  await meiliClient.waitForTask(searchTask.taskUid);

  const settings = await index.getSettings();
  console.log("[bootstrap-search] Index settings:", JSON.stringify(settings, null, 2));

  const stats = await index.getStats();
  console.log("[bootstrap-search] Index stats:", JSON.stringify(stats, null, 2));
}

ensureIndex()
  .then(() => {
    console.log("[bootstrap-search] Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[bootstrap-search] Failed:", err);
    process.exit(1);
  });
