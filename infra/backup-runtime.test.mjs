import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForPostgres,commandFailureCode,postgresCaMount} from './backup-runtime.mjs';
test('CLI diagnostics expose only fixed categories, never private driver text',()=>{
  assert.equal(commandFailureCode('root certificate file missing: private-path'),'tls');
  assert.equal(commandFailureCode('password authentication failed: private-user'),'authentication');
  assert.equal(commandFailureCode('permission denied: private-table'),'permission');
  assert.equal(commandFailureCode('unexpected private-secret'),'unclassified');
  assert.match(postgresCaMount,/source=\/etc\/ssl\/certs\/ca-certificates.crt/);
  assert.ok(postgresCaMount.endsWith(',readonly'));
});
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
