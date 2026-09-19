import { logger } from "@stax/logger";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not defined");
}

export const dbPool = new Pool({
  connectionString: databaseUrl,
});

/**
 * Execute a Postgres query helper.
 * @param text SQL query string
 * @param params Query arguments array
 */
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await dbPool.query(text, params);
  const duration = Date.now() - start;
  
  // Log queries in development mode
  if (process.env.NODE_ENV === "development") {
    logger.info(`[Database Query] executed query in ${duration}ms`, { text, rows: res.rowCount });
  }
  
  return res;
}
