import test from 'node:test';
import assert from 'node:assert/strict';
import {maintenancePolicy} from './retention-policy.mjs';
const host='ep-disposable-production-pooler.c-2.eu-west-2.aws.neon.tech';
const env={GITHUB_REF:'refs/heads/main',GITHUB_REPOSITORY:'Faysk/world-pulse',WP_RETENTION_OPERATION:'plan',WP_PRODUCTION_DB_HOST:host,
  DATABASE_URL:`postgresql://world_pulse_app:disposable@${host}/neondb?sslmode=verify-full`};
test('retention requires explicit target, restricted runtime and opt-in for writes',()=>{
  assert.equal(maintenancePolicy(env).mode,'plan');
  assert.throws(()=>maintenancePolicy({...env,WP_RETENTION_OPERATION:'maintain'}),/retention_disabled/);
  assert.equal(maintenancePolicy({...env,WP_RETENTION_OPERATION:'maintain',WP_RETENTION_ENABLED:'true'}).maxBatches,50);
  for(const patch of [{GITHUB_REF:'refs/heads/codex/test'},{GITHUB_REPOSITORY:'other/project'},{WP_PRODUCTION_DB_HOST:''},
    {WP_PRODUCTION_DB_HOST:'ep-misty-glade-za9nxlhg-pooler.c-2.eu-west-2.aws.neon.tech'},
    {DATABASE_MIGRATION_URL:'forbidden'},{DATABASE_URL:env.DATABASE_URL.replace('world_pulse_app','neondb_owner')},
    {DATABASE_URL:env.DATABASE_URL.replace('verify-full','require')},{DATABASE_URL:env.DATABASE_URL.replace(host,'ep-unexpected.neon.tech')}])assert.throws(()=>maintenancePolicy({...env,...patch}));
});
