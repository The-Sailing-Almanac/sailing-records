import { pool, closePool } from "../lib/db";

async function main() {
  try {
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("Tables in DB:", tables.rows.map(r => r.table_name));

    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'newsletters'
    `);
    console.log("Columns of newsletters:");
    console.log(res.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await closePool();
  }
}

main();
