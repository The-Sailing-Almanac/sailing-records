import { logger } from "@stax/logger";
import { MeiliSearch } from "meilisearch";
import dotenv from "dotenv";

dotenv.config();

const meiliHost = process.env.MEILI_HTTP_ADDR || "http://localhost:7700";
const meiliMasterKey = process.env.MEILI_MASTER_KEY || "your-meili-master-key-here";

// Initialize Meilisearch client
export const meiliClient = new MeiliSearch({
  host: meiliHost,
  apiKey: meiliMasterKey,
});

/**
 * Ensures that a search index exists and configures searchable/filterable attributes.
 * @param indexUid The identifier of the index (e.g. `articles`, `sailors`)
 * @param filterableAttributes Attributes to allow filtering (e.g. `['language', 'tags']`)
 */
export async function setupSearchIndex(
  indexUid: string,
  filterableAttributes: string[] = [],
  searchableAttributes: string[] = ["title", "url", "body_text", "source_name", "domain"],
  sortableAttributes: string[] = ["published_at", "created_at", "relevance_score"]
) {
  try {
    const index = await meiliClient.getIndex(indexUid);
    await index.updateFilterableAttributes(filterableAttributes);
    await index.updateSearchableAttributes(searchableAttributes);
    await index.updateSortableAttributes(sortableAttributes);
    logger.info(`[Meilisearch] Index "${indexUid}" is ready and configured.`);
  } catch {
    logger.info(`[Meilisearch] Index "${indexUid}" not found, creating it...`);
    const task = await meiliClient.createIndex(indexUid, { primaryKey: "id" });
    await meiliClient.waitForTask(task.taskUid);

    const index = await meiliClient.getIndex(indexUid);
    await index.updateFilterableAttributes(filterableAttributes);
    await index.updateSearchableAttributes(searchableAttributes);
    await index.updateSortableAttributes(sortableAttributes);
    logger.info(`[Meilisearch] Index "${indexUid}" successfully created and configured.`);
  }
}
