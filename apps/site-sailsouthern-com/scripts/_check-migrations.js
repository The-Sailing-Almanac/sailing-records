// check-migrations.js — verify Sprint 6 migrations are applied
const {Client} = require('pg');
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Error: DATABASE_URL environment variable is not defined");
  process.exit(1);
}
const c = new Client({connectionString: dbUrl});
c.connect().then(async () => {
  const al = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='article_links'
    AND column_name IN ('quality_score','is_suppressed','domain','http_status','last_checked_at','suppression_reason','source_family_id')
    ORDER BY column_name
  `);
  const fe = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='feed_endpoints'
    AND column_name IN ('http_status','validation_error','last_checked_at')
    ORDER BY column_name
  `);
  const sf = await c.query(`SELECT COUNT(*) FROM information_schema.tables WHERE table_name='source_families'`);
  console.log('article_links migration cols:', al.rows.map(r=>r.column_name).join(', ') || 'NONE - migration needed');
  console.log('feed_endpoints migration cols:', fe.rows.map(r=>r.column_name).join(', ') || 'NONE - migration needed');
  console.log('source_families table exists:', sf.rows[0].count > 0 ? 'YES' : 'NO - needed for migration 005');
  c.end();
}).catch(e => { console.error('ERROR:', e.message); c.end(); });
