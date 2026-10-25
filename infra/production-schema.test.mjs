import test from 'node:test';
import assert from 'node:assert/strict';
import {productionSchemaPolicy,applyProductionSchema,productionSchemaFiles} from './production-schema.mjs';
import {runtimeHostMetadata,productionDatabaseUrl} from './production-target.mjs';
const host='ep-disposable-production-pooler.c-2.eu-west-2.aws.neon.tech';
const env={GITHUB_REF:'refs/heads/main',GITHUB_REPOSITORY:'Faysk/world-pulse',WP_PRODUCTION_MIGRATIONS_ENABLED:'true',WP_API_ENABLED:'false',WP_PRODUCTION_DB_HOST:host,
  DATABASE_URL:`postgresql://world_pulse_app:disposable@${host}/neondb?sslmode=verify-full`,
  DATABASE_MIGRATION_URL:`postgresql://neondb_owner:owner-fixture@${host.replace('-pooler','')}/neondb?sslmode=verify-full`};
test('production schema refuses closed gate, active API, staging, wrong roles/hosts/TLS and owner pooler',()=>{
  assert.equal(productionSchemaPolicy(env).runtime,env.DATABASE_URL);
  assert.equal(runtimeHostMetadata(env.DATABASE_URL),host);
  for(const patch of [{WP_PRODUCTION_MIGRATIONS_ENABLED:''},{GITHUB_REF:'refs/heads/codex/test'},
    {GITHUB_REPOSITORY:'other/project'},{WP_API_ENABLED:'true'},{WP_API_ENABLED:undefined},{WP_PRODUCTION_DB_HOST:''},
    {WP_PRODUCTION_DB_HOST:'ep-misty-glade-za9nxlhg-pooler.c-2.eu-west-2.aws.neon.tech'},
    {DATABASE_URL:env.DATABASE_MIGRATION_URL},{DATABASE_URL:env.DATABASE_URL+'&sslmode=disable'},
    {DATABASE_MIGRATION_URL:env.DATABASE_MIGRATION_URL.replace('verify-full','require')},
    {DATABASE_MIGRATION_URL:env.DATABASE_MIGRATION_URL.replace(host.replace('-pooler',''),host)}])assert.throws(()=>productionSchemaPolicy({...env,...patch}));
  assert.throws(()=>productionDatabaseUrl(env.DATABASE_URL,host.replace('disposable','other')));
});
test('owner only applies reviewed ordered SQL; runtime verification follows owner close, never deploys',async()=>{
  const calls=[];
  const result=await applyProductionSchema({env,connectOwner:async url=>{
    assert.equal(url,env.DATABASE_MIGRATION_URL);calls.push('owner');
    return {query:async text=>{calls.push(text);return {rows:[{acquired:true}]};},end:async()=>calls.push('closed')};
  },readMigration:async file=>file,verifyRuntime:async url=>{assert.equal(url,env.DATABASE_URL);calls.push('verified');}});
  assert.ok(calls.indexOf('ALTER ROLE world_pulse_app NOINHERIT')<calls.indexOf(productionSchemaFiles[0]));
  assert.equal(result.applied,6);assert.deepEqual(calls.filter(x=>x.endsWith('.sql')),productionSchemaFiles);
  assert.deepEqual(calls.slice(-2),['closed','verified']);
});
test('disabled gate never connects; SQL failure stops further files, closes owner and never verifies success',async()=>{
  let connected=0,closed=0,verified=0;
  const deps={env:{...env,WP_PRODUCTION_MIGRATIONS_ENABLED:'false'},connectOwner:async()=>{connected++;return {query:async sql=>{
    if(sql.endsWith('.sql'))throw new Error('injected_failure');return {rows:[{acquired:true}]};},end:async()=>{closed++;}};},
    readMigration:async file=>file,verifyRuntime:async()=>{verified++;}};
  await assert.rejects(()=>applyProductionSchema(deps),/production_migrations_disabled/);assert.equal(connected,0);
  await assert.rejects(()=>applyProductionSchema({...deps,env}),/injected_failure/);
  assert.equal(connected,1);assert.equal(closed,1);assert.equal(verified,0);
});
test('a concurrent migration lock refuses SQL files and closes the owner session',async()=>{
  let reads=0,closed=0;
  await assert.rejects(()=>applyProductionSchema({env,connectOwner:async()=>({query:async()=>({rows:[{acquired:false}]}),end:async()=>{closed++;}}),
    readMigration:async()=>{reads++;},verifyRuntime:async()=>assert.fail('must not verify a refused migration')}),/production_migration_locked/);
  assert.equal(reads,0);assert.equal(closed,1);
});
