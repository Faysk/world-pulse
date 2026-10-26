import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRuntime,productionReleaseFlags } from './config.mjs';

const valid = { DATABASE_URL: 'postgresql://test:test@example.com/world?sslmode=verify-full',
  R2_ACCESS_KEY_ID: 'test', R2_SECRET_ACCESS_KEY: 'test', R2_ACCOUNT_ID: 'a'.repeat(32),
  R2_BUCKET_NAME: 'world-pulse-production', APP_URL: 'https://map.faysk.dev' };
test('accepts complete TLS configuration', () => assert.doesNotThrow(() => validateRuntime(valid)));
test('release defaults closed and refuses inconsistent API, alpha and country flags',()=>{
  assert.ok(Object.values(productionReleaseFlags({})).every(value=>value==='false'));
  for(const env of [{WP_ALPHA_RELEASE:'true'},{WP_GEO_PUBLIC_ENABLED:'true'},
    {WP_GEO_COUNTRY_ENABLED:'true',WP_API_ENABLED:'true'},{WP_API_ENABLED:'yes'}])assert.throws(()=>productionReleaseFlags(env));
  assert.equal(productionReleaseFlags({WP_ALPHA_RELEASE:'true',WP_API_ENABLED:'true'}).WP_ALPHA_RELEASE,'true');
});
test('rejects missing keys without revealing values', () => {
  assert.throws(() => validateRuntime({ ...valid, DATABASE_URL: '' }), /Missing configuration: DATABASE_URL/);
});

test('explicit maintenance keeps alpha visible only with API and every geography flag disabled',()=>{
  const env={WP_MAINTENANCE:'true',WP_ALPHA_RELEASE:'true',WP_API_ENABLED:'false'};
  const flags=productionReleaseFlags(env);
  assert.equal(flags.WP_ALPHA_RELEASE,'true');assert.equal(flags.WP_API_ENABLED,'false');
  assert.equal('WP_MAINTENANCE'in flags,false,'operational opt-in is not an app runtime variable');
  for(const key of ['WP_API_ENABLED','WP_GEO_PUBLIC_ENABLED','WP_GEO_COUNTRY_ENABLED','WP_GEO_DIRECT_EDGE'])assert.throws(()=>productionReleaseFlags({...env,[key]:'true'}));
  assert.throws(()=>productionReleaseFlags({...env,WP_MAINTENANCE:'yes'}));
  assert.throws(()=>productionReleaseFlags({...env,WP_MAINTENANCE:'false'}));
});
test('rejects plaintext or unverified database TLS', () => {
  for (const mode of ['disable', 'require', 'no-verify']) {
    assert.throws(() => validateRuntime({ ...valid, DATABASE_URL: `postgresql://test:test@example.com/db?sslmode=${mode}` }));
  }
});
test('rejects accidental target domain changes', () => {
  assert.throws(() => validateRuntime({ ...valid, APP_URL: 'https://example.com' }));
});
