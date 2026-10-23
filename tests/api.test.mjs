import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  ApiError, normalizeHashtag, validateTagId, validateTapBatch, randomColor,
  newSession, tokenHash, batchFingerprint, readSessionCookie,
  requireSameOrigin, parseBody
} from '../server/protocol.mjs';
import { route } from '../server/handlers.mjs';

function request(method, body = {}, origin = 'https://map.faysk.dev') {
  return { method, body, headers: {
    host: 'map.faysk.dev', origin, 'content-length': String(JSON.stringify(body).length)
  } };
}
function response() {
  return { headers: {}, code: 200, payload: undefined,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.code = code; return this; },
    end(data) { this.payload = JSON.parse(data); return this; }
  };
}
function stub(overrides = {}) {
  return {
    findVisitor: async () => ({ id: randomUUID(), active_tag_id: null }),
    createVisitor: async () => newSession(),
    requireVisitor: async () => ({ id: randomUUID(), active_tag_id: null }),
    createOrGetTag: async name => ({ id: randomUUID(), name, color: '#aabbcc' }),
    selectTag: async (_visitorId, tagId) => ({ activeTagId: tagId }),
    creditBatch: async (_visitorId, batch) => ({ batchId: batch.batchId, tagId: batch.tagId, creditedSeconds: String(batch.clicks), duplicate: false }),
    getCredits: async () => [],
    getRanking: async () => [],
    ...overrides
  };
}

test('Hashtag NFKC normalization and validation', () => {
  assert.equal(normalizeHashtag('   ##GTA6  '), 'gta6');
  assert.equal(normalizeHashtag(' #FÔGO_2026 '), 'fôgo_2026');
  for (const input of ['', '#', 'a', 'a b', 'a/b', '#a.b', '<script>', 'x'.repeat(33), null, 15]) {
    assert.throws(() => normalizeHashtag(input), ApiError, String(input));
  }
});
test('New sessions use unpredictable tokens stored only as hashes', () => {
  const first = newSession(), second = newSession();
  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.hash, first.token);
  assert.equal(tokenHash(first.token), first.hash);
  assert.equal(first.hash.length, 64);
  assert.equal(readSessionCookie({ headers: { cookie: 'x=a; wp_session=' + first.token + '; y=b' } }), first.token);
});
test('Tag color is a stable-format vivid hex value and never a credential', () => {
  for (let i=0; i<20; i++) assert.match(randomColor(), /^#[0-9a-f]{6}$/);
});
test('Batch input bounds, stable fingerprint and UUIDs', () => {
  const tagId = randomUUID(), batchId = randomUUID();
  assert.deepEqual(validateTapBatch({ tagId, batchId, clicks: 30 }), { tagId, batchId, clicks: 30 });
  assert.equal(batchFingerprint(tagId, 5), batchFingerprint(tagId, 5));
  assert.notEqual(batchFingerprint(tagId, 5), batchFingerprint(tagId, 6));
  for (const clicks of [-1, 0, 31, 1.5, '2', Infinity, NaN]) {
    assert.throws(() => validateTapBatch({ tagId, batchId, clicks }), ApiError);
  }
  assert.throws(() => validateTagId('not-a-uuid'), ApiError);
});
test('Same origin is required for write operations', () => {
  assert.doesNotThrow(() => requireSameOrigin(request('POST')));
  assert.throws(() => requireSameOrigin(request('POST', {}, 'https://evil.example')), { status: 403 });
  assert.throws(() => requireSameOrigin({ headers: { host: 'map.faysk.dev' } }), { status: 403 });
});
test('Requests exceeding the body limit are rejected', () => {
  assert.throws(() => parseBody(request('POST', { payload: 'x'.repeat(9000) })), { status: 413 });
});
test('Public ranking GET never requires or returns visitor identity', async () => {
  const res = response();
  await route('ranking', stub({ getRanking: async () => [{ name: '#gta6', historicalParticipants: '3', creditedSeconds: '12' }] }))(
    { method: 'GET', headers: {} }, res
  );
  assert.equal(res.code, 200);
  assert.equal(res.payload.type, 'historical');
  assert.equal(res.payload.ranking[0].historicalParticipants, '3');
});
test('Session POST sets HttpOnly, SameSite and Secure cookie for new visitor', async () => {
  const visitor = { id: randomUUID(), active_tag_id: null };
  const res = response();
  await route('session', stub({
    findVisitor: async () => null,
    requireVisitor: async token => { assert.match(token, /^[A-Za-z0-9_-]{43}$/); return visitor; }
  }))(request('POST'), res);
  assert.equal(res.code, 200);
  assert.equal(res.payload.anonymous, true);
  assert.match(res.headers['Set-Cookie'], /HttpOnly/);
  assert.match(res.headers['Set-Cookie'], /SameSite=Lax/);
  assert.match(res.headers['Set-Cookie'], /Secure/);
  assert.equal('visitorId' in res.payload, false);
});
test('Cross-origin tag writes rejected before session resolution', async () => {
  let touched = false; const res=response();
  await route('tags', stub({ requireVisitor: async () => { touched=true; } }))(
    request('POST',{name:'#gta6'},'https://evil.example'),res
  );
  assert.equal(res.code,403);
  assert.equal(touched,false);
});
test('Selection must pass a valid tag ID', async () => {
  const res=response();
  await route('select',stub())(request('POST',{tagId:'hello'}),res);
  assert.equal(res.code,400);
});
test('Writes are rejected for unsupported methods', async () => {
  const res=response();
  await route('taps',stub())({method:'GET',headers:{}},res);
  assert.equal(res.code,405);
});
test('Tap endpoint attributes clicks to the originally supplied hashtag', async () => {
  const a=randomUUID(), batchId=randomUUID();let received;
  const res=response();
  await route('taps',stub({ creditBatch:async (_visitor, batch)=>{received=batch;return {acceptedClicks:batch.clicks};} }))(
    request('POST',{tagId:a,batchId,clicks:2}),res
  );
  assert.equal(res.code,200);
  assert.deepEqual(received,{tagId:a,batchId,clicks:2});
});
