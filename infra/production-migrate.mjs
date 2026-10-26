import {readFile,appendFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import pg from 'pg';
import {beginLimitedTransaction} from '../server/databaseLimits.mjs';
import {applyProductionSchema} from './production-schema.mjs';

async function verifyRuntime(connectionString){
  const client=new pg.Client({connectionString,connectionTimeoutMillis:5000,query_timeout:6000});
  try{
    await client.connect();await beginLimitedTransaction(client);
    const {rows:[role]}=await client.query(`SELECT current_user AS name,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolbypassrls,
      (SELECT count(*)::int FROM pg_auth_members WHERE member=pg_roles.oid) AS memberships,
      has_schema_privilege(current_user,'world_pulse','CREATE') AS schema_create,
      has_schema_privilege(current_user,'public','CREATE') AS public_create FROM pg_roles WHERE rolname=current_user`);
    console.log('Runtime permission audit: '+JSON.stringify(role)); // Role flags only; no credentials or session identifiers.
    if(role?.name!=='world_pulse_app'||Object.entries(role).some(([key,value])=>
      key==='name'?false:key==='memberships'?value!==0:value!==false))throw new Error('production_runtime_permissions_rejected');
    for(const query of ['SELECT id FROM world_pulse.tags LIMIT 0','SELECT expires_at FROM world_pulse.visitor_tags LIMIT 0',
      'SELECT region_cell,region_shared_at,last_seen_at,country_code,country_consent FROM world_pulse.visitors LIMIT 0',
      'SELECT batch_id FROM world_pulse.tap_batches LIMIT 0','SELECT scope FROM world_pulse.operation_budgets LIMIT 0',
      'SELECT participants FROM world_pulse.tag_history_totals LIMIT 0','SELECT payload FROM world_pulse.country_snapshot_cache LIMIT 0','SELECT payload FROM world_pulse.region_snapshot_cache LIMIT 0'])await client.query(query);
    await client.query('COMMIT');
  }finally{await client.end();}
}

export async function main(env=process.env){
  const result=await applyProductionSchema({env,connectOwner:async connectionString=>{
    const client=new pg.Client({connectionString,connectionTimeoutMillis:15000,query_timeout:35000});
    try{await client.connect();return client;}catch(error){await client.end();throw error;}
  },readMigration:file=>readFile(new URL('sql/'+file,import.meta.url),'utf8'),verifyRuntime,
  report:file=>console.log(`Production schema migration applied: ${file}`)});
  console.log('Production schema and restricted runtime verified. No sync, deployment or activation performed.');
  if(env.GITHUB_STEP_SUMMARY)await appendFile(env.GITHUB_STEP_SUMMARY,
    `Production schema: ${result.applied} reviewed migrations applied; restricted runtime verified.\n\nCommit: ${env.GITHUB_SHA}\n\nAPI/alpha activation and publication remain separate.\n`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{
  const safe=['production_migrations_disabled','production_migration_target_rejected','production_api_must_be_disabled',
    'production_host_not_attested','production_database_rejected','production_migration_locked','production_runtime_permissions_rejected'];
  console.error(safe.includes(error.message)?error.message:'Production schema operation failed; private details suppressed. Stop and inspect applied migration stages before retry.');
  if(/^[0-9A-Z]{5}$/.test(error.code??''))console.error(`SQLSTATE: ${error.code}`);
  process.exitCode=1;
});
