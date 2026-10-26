import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryFixtureContext} from './recovery-policy.mjs';
test('service recovery drill refuses cloud credentials and arbitrary container names',()=>{
  const valid={WP_RECOVERY_DRILL:'synthetic-loopback',WP_RECOVERY_CONTAINER:'a'.repeat(64)};
  assert.equal(recoveryFixtureContext(valid),valid.WP_RECOVERY_CONTAINER);
  for(const patch of [{WP_RECOVERY_DRILL:''},{WP_RECOVERY_CONTAINER:'production'},{DATABASE_URL:'remote'},{DATABASE_MIGRATION_URL:'owner'},{VERCEL_TOKEN:'token'},{WP_BACKUP_ENCRYPTION_KEY:'key'},{R2_BACKUP_SECRET_ACCESS_KEY:'secret'}])assert.throws(()=>recoveryFixtureContext({...valid,...patch}),/context_rejected/);
});
