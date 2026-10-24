import {stagingEndpoint} from './staging-db.mjs';
export function maintenancePolicy(env){
  if(env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_REPOSITORY!=='Faysk/world-pulse')throw new Error('retention_target_rejected');
  const mode=env.WP_RETENTION_OPERATION;
  if(!['plan','maintain'].includes(mode))throw new Error('retention_operation_required');
  if(mode==='maintain'&&env.WP_RETENTION_ENABLED!=='true')throw new Error('retention_disabled');
  if(env.DATABASE_MIGRATION_URL)throw new Error('retention_owner_forbidden');
  const expected=env.WP_PRODUCTION_DB_HOST;
  if(!/^ep-[a-z0-9-]+-pooler\.c-2\.eu-west-2\.aws\.neon\.tech$/.test(expected??'')||expected.startsWith(stagingEndpoint+'-'))throw new Error('retention_host_not_attested');
  let database;
  try{database=new URL(env.DATABASE_URL);}catch{throw new Error('retention_database_rejected');}
  if(!['postgres:','postgresql:'].includes(database.protocol)||database.hostname!==expected||database.port||database.pathname!=='/neondb'||
    database.username!=='world_pulse_app'||!database.password||database.searchParams.get('sslmode')!=='verify-full')throw new Error('retention_database_rejected');
  return {mode,connectionString:database.toString(),batchSize:100,maxBatches:50,maxDurationMs:50000};
}
