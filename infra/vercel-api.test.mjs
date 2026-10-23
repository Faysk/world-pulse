import test from 'node:test';
import assert from 'node:assert/strict';
import { vercelApi } from './vercel-api.mjs';

test('successful promotion with an empty response does not fail the release', async () => {
  const api = vercelApi({ token: 'test', team: 'team', fetcher: async () => new Response(null, { status: 204 }) });
  assert.deepEqual(await api('/v10/projects/project/promote/deployment', { method: 'POST', body: '{}' }), {});
});
test('API reads JSON responses and suppresses private provider error bodies', async () => {
  const api = vercelApi({ token: 'test', team: 'team', fetcher: async () => new Response('{"readyState":"READY"}') });
  assert.deepEqual(await api('/v13/deployments/id'), { readyState: 'READY' });
  const failed = vercelApi({ token: 'test', team: 'team', fetcher: async () => new Response('private details', { status: 403 }) });
  await assert.rejects(failed('/v13/deployments/id'), error => error.message === 'Vercel API request failed');
});
