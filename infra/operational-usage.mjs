import pg from 'pg';
import {backupDatabase} from './backup-core.mjs';
let db;
try{
  if(process.env.GITHUB_REPOSITORY!=='Faysk/world-pulse'||process.env.GITHUB_REF!=='refs/heads/main'||process.env.DATABASE_MIGRATION_URL)throw new Error('usage_context_rejected');
  const connection=backupDatabase(process.env.DATABASE_URL);
  db=new pg.Client({host:connection.PGHOST,user:connection.PGUSER,password:connection.PGPASSWORD,database:connection.PGDATABASE,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:15000,query_timeout:15000});
  await db.connect();await db.query('BEGIN READ ONLY');await db.query("SET LOCAL statement_timeout='10s'");
  const {rows:[database]}=await db.query("SELECT current_setting('server_version_num')::int AS version,pg_database_size(current_database())::text AS bytes");
  const {rows:tables}=await db.query("SELECT relname AS table, n_live_tup::text AS estimated_rows FROM pg_stat_user_tables WHERE schemaname='world_pulse' ORDER BY relname");
  const {rows:budgets}=await db.query('SELECT scope,window_start,used FROM world_pulse.operation_budgets ORDER BY scope');
  await db.query('ROLLBACK');
  console.log(JSON.stringify({measuredAt:new Date().toISOString(),database,tables,budgets,note:'Estimated table counts and current application budget windows, not billing or provider quota.'},null,2));
}catch{console.error('Aggregate operational usage query failed; private details suppressed.');process.exitCode=1;}
finally{await db?.end().catch(()=>{});}
