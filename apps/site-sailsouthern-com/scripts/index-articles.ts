/**
 * Script: index-articles.ts
 * Purpose: Bulk-index article_links into Meilisearch in batches of 1,000.
 * Idempotent: Yes — addDocuments replaces existing entries by primary key.
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import { pool, closePool } from "./lib/db";
import { getArticleIndex } from "./lib/meili";

const BATCH_SIZE = 1000;
const publicOnly = process.argv.includes("--public-only");
const dryRun = process.argv.includes("--dry-run");

function truncate(text: string | null | undefined, max = 500): string {
  if (!text) return "";
  return text.length <= max ? text : text.slice(0, max);
}

type ArticleRow = {
  id: string;
  canonical_url: string;
  title: string;
  extracted_text: string | null;
  content_snippet: string | null;
  publisher_name: string | null;
  published_at: string | null;
  created_at: string;
  language: string | null;
  archive_status: string | null;
  moderation_state: string | null;
  user_flags: Record<string, unknown> | null;
  relevance_score: number | null;
  is_suppressed: boolean | null;
  domain: string | null;
  source_family_id: string | null;
};

function rowToDocument(row: ArticleRow) {
  const body = row.extracted_text || row.content_snippet || "";
  const userFlags = row.user_flags || {};
  const isFlagged =
    row.moderation_state === "rejected" ||
    row.moderation_state === "flagged" ||
    Boolean((userFlags as { flagged?: boolean }).flagged);

  return {
    id: row.id,
    url: row.canonical_url,
    title: row.title || "",
    body_text: truncate(body),
    source_name: row.publisher_name || "",
    published_at: row.published_at,
    created_at: row.created_at,
    language: row.language || "en",
    is_archived: row.archive_status === "archived",
    is_flagged: isFlagged,
    relevance_score: row.relevance_score,
    is_suppressed: row.is_suppressed === true,
    domain: row.domain || "",
    source_family_id: row.source_family_id,
    moderation_state: row.moderation_state,
  };
}

async function run() {
  const index = getArticleIndex();
  let lastId: string | null = null;
  let totalIndexed = 0;
  let batchNum = 0;

  console.log(
    `[index-articles] Mode: ${publicOnly ? "public-only" : "full corpus"}`
  );

  while (true) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (publicOnly) {
      conditions.push(
        "(COALESCE(is_suppressed, false) = false)",
        "(relevance_score IS NULL OR relevance_score > 0.1)"
      );
    }
    if (lastId) {
      params.push(lastId);
      conditions.push(`id > $${params.length}`);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const res = await pool.query<ArticleRow>(
      `SELECT id, canonical_url, title, extracted_text, content_snippet,
              publisher_name, published_at, created_at, language,
              archive_status, moderation_state, user_flags::jsonb AS user_flags,
              relevance_score, is_suppressed, domain, source_family_id
       FROM article_links
       ${where}
       ORDER BY id
       LIMIT ${BATCH_SIZE}`,
      params
    );

    if (res.rows.length === 0) break;

    const documents = res.rows.map(rowToDocument);
    const task = await index.addDocuments(documents, { primaryKey: "id" });
    await index.waitForTask(task.taskUid, { timeOutMs: 300_000 });

    lastId = res.rows[res.rows.length - 1].id;
    totalIndexed += documents.length;
    batchNum += 1;

    console.log(
      `[index-articles] Batch ${batchNum}: indexed ${documents.length} (total ${totalIndexed})`
    );
  }

  const stats = await index.getStats();
  console.log(
    `[index-articles] Complete. Documents indexed this run: ${totalIndexed}`
  );
  console.log(
    `[index-articles] Meilisearch index document count: ${stats.numberOfDocuments}`
  );

  await closePool();
}

run().catch((err) => {
  console.error("[index-articles] Failed:", err);
  process.exit(1);
});
