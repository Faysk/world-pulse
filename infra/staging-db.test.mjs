import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateStagingUrl, stagingExpiresAt } from './staging-db.mjs';

const runtime = 'postgresql://world_pulse_app:disposable@ep-misty-glade-za9nxlhg-pooler.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full';
const now = Date.parse('2026-10-24T02:00:00Z');
test('staging refuses production, arbitrary hosts, owner runtime, insecure TLS and expired branch', () => {
  assert.equal(validateStagingUrl(runtime, false, now), runtime);
  for (const value of [runtime.replace('ep-misty-glade-za9nxlhg', 'ep-production'),
    runtime.replace('.aws.neon.tech', '.aws.neon.tech.attacker.invalid'),
    runtime.replace('world_pulse_app', 'neondb_owner'), runtime.replace('verify-full', 'require'),
    runtime.replace('/neondb?', '/other?'), runtime.replace('/neondb?', ':5433/neondb?')]) {
    assert.throws(() => validateStagingUrl(value, false, now));
  }
  assert.throws(() => validateStagingUrl(runtime, false, Date.parse(stagingExpiresAt)));
});
test('migration owner must use the exact unpooled staging endpoint', () => {
  const owner = runtime.replace('world_pulse_app', 'neondb_owner').replace('-pooler', '');
  assert.equal(validateStagingUrl(owner, true, now), owner);
  assert.throws(() => validateStagingUrl(runtime, true, now));
});
