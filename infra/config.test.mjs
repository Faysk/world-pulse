import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRuntime } from './config.mjs';

const valid = { DATABASE_URL: 'postgresql://test:test@example.com/world?sslmode=verify-full',
  R2_ACCESS_KEY_ID: 'test', R2_SECRET_ACCESS_KEY: 'test', R2_ACCOUNT_ID: 'a'.repeat(32),
  R2_BUCKET_NAME: 'world-pulse-production', APP_URL: 'https://map.faysk.dev' };
test('accepts complete TLS configuration', () => assert.doesNotThrow(() => validateRuntime(valid)));
test('rejects missing keys without revealing values', () => {
  assert.throws(() => validateRuntime({ ...valid, DATABASE_URL: '' }), /Missing configuration: DATABASE_URL/);
});
test('rejects plaintext or unverified database TLS', () => {
  for (const mode of ['disable', 'require', 'no-verify']) {
    assert.throws(() => validateRuntime({ ...valid, DATABASE_URL: `postgresql://test:test@example.com/db?sslmode=${mode}` }));
  }
});
test('rejects accidental target domain changes', () => {
  assert.throws(() => validateRuntime({ ...valid, APP_URL: 'https://example.com' }));
});
