import {productionDatabaseUrl} from './production-target.mjs';
export const productionSchemaFiles=['0002-participation-core.sql','0003-time-balances.sql','0004-operation-budgets.sql','0005-retention-rollups.sql','0006-country-geography.sql'];
export function productionSchemaPolicy(env){
  if(env.WP_PRODUCTION_MIGRATIONS_ENABLED!=='true')throw new Error('production_migrations_disabled');
  if(env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_REPOSITORY!=='Faysk/world-pulse')throw new Error('production_migration_target_rejected');
  if(env.WP_API_ENABLED!=='false')throw new Error('production_api_must_be_disabled');
  return {runtime:productionDatabaseUrl(env.DATABASE_URL,env.WP_PRODUCTION_DB_HOST),
    owner:productionDatabaseUrl(env.DATABASE_MIGRATION_URL,env.WP_PRODUCTION_DB_HOST,true)};
}
// Dependencies are explicit so CI can prove sequencing/failure without production access.
export async function applyProductionSchema({env,connectOwner,readMigration,verifyRuntime,report=()=>{}}){
  const policy=productionSchemaPolicy(env);
  const client=await connectOwner(policy.owner);
  try{
    const {rows:[lock]}=await client.query('SELECT pg_try_advisory_lock(1867402) AS acquired');
    if(!lock?.acquired)throw new Error('production_migration_locked');
    await client.query("SET statement_timeout='30s'");await client.query("SET lock_timeout='3s'");
    for(const file of productionSchemaFiles){await client.query(await readMigration(file));report(file);}
  }finally{await client.end();} // Closing the direct owner session releases its advisory lock.
  await verifyRuntime(policy.runtime);
  return {applied:productionSchemaFiles.length};
}
