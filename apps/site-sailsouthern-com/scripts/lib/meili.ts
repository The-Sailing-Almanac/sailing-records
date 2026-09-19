import { MeiliSearch } from "meilisearch";
import dotenv from "dotenv";

dotenv.config();

export const ARTICLE_INDEX_UID = "article_links";

const meiliHost = process.env.MEILI_HTTP_ADDR || "http://localhost:7700";
const meiliMasterKey =
  process.env.MEILI_MASTER_KEY || "your-meili-master-key-here";

export const meiliClient = new MeiliSearch({
  host: meiliHost,
  apiKey: meiliMasterKey,
  timeout: 120_000,
});

export function getArticleIndex() {
  return meiliClient.index(ARTICLE_INDEX_UID);
}
