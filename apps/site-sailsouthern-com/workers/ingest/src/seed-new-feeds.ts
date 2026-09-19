import { logger } from "@stax/logger";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("DATABASE_URL environment variable is not defined");
}
const db = new Pool({
  connectionString: dbUrl,
});

const feeds = [
  "https://www.sail-world.com/RSS/Sail-World-USA",
  "http://www.rule69blog.com/feed/",
  "https://www.seahorsemagazine.com/rss",
  "https://www.livesaildie.com/feed/",
  "https://www.mysailing.com.au/feed/"
];

async function seed() {
  logger.info("Seeding new feeds...");
  for (const url of feeds) {
    try {
      const res = await db.query(
        "INSERT INTO feed_endpoints (url, is_active) VALUES ($1, true) ON CONFLICT (url) DO NOTHING",
        [url]
      );
      logger.info(`- Feeds check/seeded: ${url}`);
    } catch (e: any) {
      logger.error(`- Failed to seed ${url}:`, e.message);
    }
  }
  await db.end();
  logger.info("Seeding complete!");
}

seed().catch(console.error);
