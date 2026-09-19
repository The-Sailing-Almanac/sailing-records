const {Client}=require('pg');
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Error: DATABASE_URL environment variable is not defined");
  process.exit(1);
}
const c=new Client({connectionString:dbUrl});
c.connect().then(()=>Promise.all([
  c.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename='article_links'"),
  c.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename='feed_endpoints'"),
  c.query("SELECT column_name, column_default, is_nullable FROM information_schema.columns WHERE table_name='article_links' ORDER BY ordinal_position"),
])).then(([ai,fi,ac])=>{
  console.log('=== article_links indexes ===');
  ai.rows.forEach(r=>console.log(r.indexname+': '+r.indexdef));
  console.log('=== feed_endpoints indexes ===');
  fi.rows.forEach(r=>console.log(r.indexname+': '+r.indexdef));
  console.log('=== article_links columns detail ===');
  ac.rows.forEach(r=>console.log(r.column_name+'|default='+r.column_default+'|nullable='+r.is_nullable));
  c.end();
}).catch(e=>{console.error(e.message);process.exit(1);});
