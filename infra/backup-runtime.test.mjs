import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForPostgres} from './backup-runtime.mjs';
test('readiness ignores the socket-only initialization phase and waits for final TCP listener',async()=>{
  let attempts=0,pauses=0;
  const run=args=>{
    assert.ok(args.includes('-h'));assert.ok(args.includes('127.0.0.1'));
    if(++attempts<3)throw new Error('temporary socket-only server, not the final TCP server');
  };
  await waitForPostgres('world-pulse-backup-fixture',run,async()=>{pauses++;});
  assert.equal(attempts,3);assert.equal(pauses,2);
});
test('readiness fails after a bounded number of startup attempts',async()=>{
  let attempts=0;
  await assert.rejects(waitForPostgres('world-pulse-backup-restore',()=>{attempts++;throw new Error('not ready');},async()=>{}),/backup_database_not_ready/);
  assert.equal(attempts,40);
});
