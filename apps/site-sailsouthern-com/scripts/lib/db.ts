import { Pool, QueryResultRow } from "pg";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not defined");
}

export const pool = new Pool({ connectionString: databaseUrl });

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: unknown[]
) {
  return pool.query<T>(text, params);
}

export async function closePool() {
  await pool.end();
}
