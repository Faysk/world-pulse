import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('Disposable harness refuses missing opt-in and production database variables before connecting', () => {
  for (const extra of [{WP_ISOLATED_TEST:''},
    {WP_ISOLATED_TEST:'1',DATABASE_URL:'postgresql://example.invalid/do-not-connect'},
    {WP_ISOLATED_TEST:'1',DATABASE_MIGRATION_URL:'postgresql://example.invalid/do-not-connect'}]) {
    const result=spawnSync(process.execPath,['scripts/isolated-participation.mjs'],{
      cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:10000,
      env:{...process.env,DATABASE_URL:'',DATABASE_MIGRATION_URL:'',...extra}
    });
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/Isolated harness requires explicit opt-in/);
    assert.equal(result.stderr.includes('do-not-connect'),false);
  }
});
