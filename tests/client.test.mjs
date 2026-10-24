import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ParticipationClient } from '../src/participationClient.ts';

const ID_A = randomUUID();
const ID_B = randomUUID();

function fakeStorage() {
  const map = new Map();
  return {
    getItem: name => map.get(name) ?? null,
    setItem: (name, value) => { map.set(name, value); }
  };
}
function mockTransport({ failOnce = false, loseResponseOnce = false } = {}) {
  const calls = [];
  const credited = new Map();
  const accepted = new Map();
  let shouldFail = failOnce;
  const handle = async (path, init) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, body });
    if (path === '/api/session') return Response.json({ anonymous: true, activeTagId: null, credits: [] });
    if (path === '/api/tags') {
      const a = body.name.toLowerCase().includes('gta');
      return Response.json({ tag: { id: a ? ID_A : ID_B, color: a ? '#ffffff' : '#123456', name: a ? '#gta6' : '#lofi' } });
    }
    if (path === '/api/select') return Response.json({ activeTagId: body.tagId });
    if (path === '/api/ranking') return Response.json({ type: 'historical', ranking: [] });
    if (path === '/api/taps') {
      if (shouldFail) { shouldFail = false; throw new Error('network-failure'); }
      const existing = accepted.get(body.batchId);
      if (existing) {
        assert.deepEqual(existing, body, 'retry must have an identical payload');
      } else {
        accepted.set(body.batchId, body);
        credited.set(body.tagId, (credited.get(body.tagId) || 0) + body.clicks);
      }
      if (loseResponseOnce) { loseResponseOnce = false; throw new Error('response-lost'); }
      return Response.json({ batchId: body.batchId, tagId:body.tagId, duplicate: Boolean(existing),
        creditedSeconds: String(credited.get(body.tagId)), serverNowMs:1000, expiresAtMs:5000, remainingMs:4000 });
    }
    throw new Error('unexpected API route ' + path);
  };
  return { handle, calls, credited, accepted };
}

test('Queued +1 taps are grouped into bounded idempotent batches', async () => {
  const storage = fakeStorage(), transport = mockTransport();
  const client = new ParticipationClient(transport.handle, storage, randomUUID);
  assert.equal(client.creditClick(), false, 'no active tag');
  await client.selectTag('#GTA6');
  for (let i=0; i<65; i++) assert.equal(client.creditClick(), true);
  assert.equal(client.pendingClicks(), 65);
  await client.flush();
  assert.equal(client.pendingClicks(), 0);
  assert.equal(transport.credited.get(ID_A), 65);
  assert.deepEqual(transport.calls.filter(x => x.path === '/api/taps').map(x => x.body.clicks), [30,30,5]);
  assert.equal(client.pendingClicks(), 0);
});

test('Network failure does not mutate retry batch ID or tap count', async () => {
  const storage = fakeStorage(), transport = mockTransport({ failOnce: true });
  const client = new ParticipationClient(transport.handle, storage, randomUUID);
  await client.selectTag('#GTA6');
  for (let i=0; i<4; i++) client.creditClick();
  await assert.rejects(() => client.flush(), /network-failure/);
  const pending = JSON.parse(storage.getItem('world-pulse-pending-v1'));
  assert.equal(pending.length, 1);
  const original = pending[0];
  assert.equal(original.clicks, 4);
  assert.equal(client.pendingClicks(), 4);
  // Reload same browser tab/session and retry without generating a new batch.
  const restored = new ParticipationClient(transport.handle, storage, randomUUID);
  await restored.flush();
  assert.equal(restored.pendingClicks(), 0);
  const attempts = transport.calls.filter(x => x.path === '/api/taps');
  assert.deepEqual(attempts[0].body, attempts[1].body);
  assert.equal(transport.credited.get(ID_A), 4);
});

test('A -> B selection preserves the already queued original tag credits', async () => {
  const transport = mockTransport(), client = new ParticipationClient(transport.handle, fakeStorage(), randomUUID);
  const [a, b] = await Promise.all([client.selectTag('#GTA6'), client.selectTag('#LoFi')]);
  assert.equal(a.id, ID_A);
  assert.equal(b.id, ID_B);
  assert.deepEqual(transport.calls.filter(x => x.path === '/api/select').map(x => x.body.tagId), [ID_A, ID_B]);
  // Switch back to A to enqueue one tap, then B to enqueue another.
  await client.selectTag('#GTA6');
  client.creditClick();
  await client.selectTag('#LoFi');
  client.creditClick();
  await client.flush();
  assert.equal(transport.credited.get(ID_A), 1);
  assert.equal(transport.credited.get(ID_B), 1);
  await client.clearSelection();
  assert.equal(client.creditClick(), false);
});

test('New taps after a lost response never change the already accepted batch fingerprint', async () => {
  const storage = fakeStorage(), transport = mockTransport({loseResponseOnce:true});
  const client = new ParticipationClient(transport.handle,storage,randomUUID);
  await client.selectTag('#GTA6');
  for(let i=0;i<4;i++) client.creditClick();
  await assert.rejects(client.flush(),/response-lost/);
  for(let i=0;i<2;i++) client.creditClick();
  await client.flush();
  const attempts = transport.calls.filter(x=>x.path==='/api/taps');
  assert.deepEqual(attempts[0].body,attempts[1].body);
  assert.notEqual(attempts[1].body.batchId,attempts[2].body.batchId);
  assert.equal(transport.credited.get(ID_A),6);
  assert.equal(client.pendingClicks(),0);
});

test('Restored unacknowledged batches stay frozen even after new taps in the same hashtag', async () => {
  const storage = fakeStorage(), transport = mockTransport({loseResponseOnce:true});
  const original = new ParticipationClient(transport.handle,storage,randomUUID);
  await original.selectTag('#GTA6');
  original.creditClick();
  await assert.rejects(original.flush(),/response-lost/);
  const restored = new ParticipationClient(transport.handle,storage,randomUUID);
  await restored.selectTag('#GTA6');
  restored.creditClick();
  await restored.flush();
  assert.equal(transport.credited.get(ID_A),2);
  assert.equal(restored.pendingClicks(),0);
});

test('Ranking is explicitly historical, never real-time presence', async () => {
  const transport = mockTransport(), client = new ParticipationClient(transport.handle, fakeStorage());
  const result = await client.ranking();
  assert.equal(result.type, 'historical');
  assert.deepEqual(result.ranking, []);
});

test('Malformed stored queue is ignored rather than replaying fabricated clicks', async () => {
  const storage = fakeStorage();
  storage.setItem('world-pulse-pending-v1', JSON.stringify([{batchId:'nope',tagId:'x',clicks:100000}]));
  const client = new ParticipationClient(mockTransport().handle, storage);
  assert.equal(client.pendingClicks(),0);
});

test('Returning browser restores selected tag and independent server balance snapshots', async () => {
  const credits = [
    {tagId:ID_A,creditedSeconds:'28800',serverNowMs:1000,expiresAtMs:9000,remainingMs:8000},
    {tagId:ID_B,creditedSeconds:'30',serverNowMs:1000,expiresAtMs:500,remainingMs:0}
  ];
  const client = new ParticipationClient(async () => Response.json({anonymous:true,activeTagId:ID_A,credits}),fakeStorage(),randomUUID);
  await client.connect();
  assert.deepEqual(client.balances(),credits);
  assert.equal(client.creditClick(),true);
  const copy = client.balances();
  copy[0].remainingMs=0;
  assert.equal(client.balances()[0].remainingMs,8000);
});

test('Each balance counts down on its own monotonic clock, including while topping up another tag', async () => {
  let elapsed=100000;
  const transport=mockTransport();
  const client=new ParticipationClient(transport.handle,fakeStorage(),randomUUID,()=>elapsed);
  await client.selectTag('#GTA6');client.creditClick();await client.flush();
  assert.equal(client.remainingMilliseconds(ID_A),4000);
  elapsed+=1500;
  await client.selectTag('#LoFi');client.creditClick();await client.flush();
  assert.equal(client.remainingMilliseconds(ID_A),2500);
  assert.equal(client.remainingMilliseconds(ID_B),4000);
  elapsed+=3000;
  assert.equal(client.remainingMilliseconds(ID_A),0);
  assert.equal(client.remainingMilliseconds(ID_B),1000);
});
