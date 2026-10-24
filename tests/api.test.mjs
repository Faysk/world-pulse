import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  ApiError, normalizeHashtag, validateTagId, validateTapBatch, randomColor,
  newSession, tokenHash, batchFingerprint, readSessionCookie,
  requireSameOrigin, parseBody
} from '../server/protocol.mjs';
import { route } from '../server/handlers.mjs';
// Test-only environment: production stays disabled unless explicitly enabled.
process.env.WP_API_ENABLED = 'true';

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
    consumeApiBudget: async () => undefined,
    setCountryConsent:async()=>undefined,
    getCountrySnapshot:async()=>({type:'country_snapshot',asOfMs:0,validUntilMs:5000,granularity:'country',privacyThreshold:5,tags:[]}),
    findVisitor: async () => ({ id: randomUUID(), active_tag_id: null }),
    createVisitor: async () => newSession(),
    requireVisitor: async () => ({ id: randomUUID(), active_tag_id: null }),
    createOrGetTag: async name => ({ id: randomUUID(), name, color: '#aabbcc' }),
    selectTag: async (_visitorId, tagId) => ({ activeTagId: tagId }),
    creditBatch: async (_visitorId, batch) => ({ batchId: batch.batchId, tagId: batch.tagId, creditedSeconds: String(batch.clicks), duplicate: false }),
    getCredits: async () => [],
    getRanking: async () => [],
    getActiveBalanceSnapshot: async () => ({ type: 'active', asOfMs: 1000, geography: 'unavailable', metric: 'distinct_anonymous_sessions_with_positive_balance', ranking: [] }),
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
test('Historical GET is separate from current ranking and never returns visitor identity', async () => {
  const res = response();
  await route('history', stub({ getRanking: async () => [{ name: '#gta6', historicalParticipants: '3', creditedSeconds: '12' }] }))(
    { method: 'GET', headers: {} }, res
  );
  assert.equal(res.code, 200);
  assert.equal(res.payload.type, 'historical');
  assert.equal(res.payload.ranking[0].historicalParticipants, '3');
});

test('Main ranking is current participation, independent from historical seconds', async () => {
  const res=response();
  await route('ranking',stub({getRanking:async()=>{throw new Error('historical route must not be used');}}))(
    {method:'GET',headers:{}},res);
  assert.equal(res.code,200);
  assert.equal(res.payload.type,'active');
  assert.equal(res.payload.metric,'distinct_anonymous_sessions_with_positive_balance');
  assert.equal(res.payload.asOfMs,1000);
});

test('A shared budget denial never executes the domain operation and has retry guidance', async () => {
  let created=false;
  const res=response();
  await route('session',stub({
    consumeApiBudget:async()=>{throw new ApiError(429,'operation_budget_exhausted','Limite temporário.');},
    findVisitor:async()=>{created=true;return null;}
  }))(request('POST'),res);
  assert.equal(res.code,429);
  assert.equal(res.headers['Retry-After'],'60');
  assert.equal(created,false);
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

test('Return refreshes the same cookie and long positive balances retain a recovery window', async () => {
  const session=newSession();
  const req=request('POST');req.headers.cookie='wp_session='+session.token;
  const res=response();
  await route('session',stub({findVisitor:async()=>({id:session.visitorId,active_tag_id:null,
    expires_at:new Date(Date.now()+60*86400000)})}))(req,res);
  assert.equal(res.payload.sessionFresh,false);
  assert.ok(res.headers['Set-Cookie'].startsWith('wp_session='+session.token+';'));
  const seconds=Number(res.headers['Set-Cookie'].match(/Max-Age=(\d+)/)[1]);
  assert.ok(seconds>59*86400 && seconds<=60*86400);
  assert.match(res.headers['Set-Cookie'],/HttpOnly.*SameSite=Lax.*Secure/);
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
  const token=newSession().token;
  const req=request('POST',{tagId:a,batchId,clicks:2});
  req.headers.cookie='wp_session='+token;
  req.headers['x-wp-session-binding']=tokenHash('world-pulse-queue-binding-v1:'+token);
  await route('taps',stub({ creditBatch:async (_visitor, batch)=>{received=batch;return {acceptedClicks:batch.clicks};} }))(
    req,res
  );
  assert.equal(res.code,200);
  assert.deepEqual(received,{tagId:a,batchId,clicks:2});
});

test('Malformed JSON returns a client error, not HTTP 500', async () => {
  const req = request('POST',{});
  req.body = '{ invalid json';
  const res = response();
  await route('session',stub())(req,res);
  assert.equal(res.code,400);
  assert.equal(res.payload.error,'invalid_json');
});

test('Real participation endpoints default to disabled even with valid requests', async () => {
  process.env.WP_API_ENABLED = 'false';
  try {
    const res=response();
    await route('session',stub())(request('POST'),res);
    assert.equal(res.code,503);
    assert.equal(res.payload.error,'participation_disabled');
    const ranking=response();
    await route('ranking',stub())({method:'GET',headers:{}},ranking);
    assert.equal(ranking.code,503);
  } finally {
    process.env.WP_API_ENABLED = 'true';
  }
});

test('Experimental activity route labels active pseudonymous balances, not historical seconds', async () => {
  const res = response();
  await route('activity', stub({ getActiveBalanceSnapshot: async () => ({
    type: 'active',
    asOfMs: 1000,
    metric: 'distinct_anonymous_sessions_with_positive_balance',
    geography: 'unavailable',
    ranking: [{ id: randomUUID(), name: '#gta6', color: '#aabbcc',
      activeParticipants: '1', historicalParticipants: '3', creditedSeconds: '999' }]
  }) }))({method:'GET',headers:{}},res);
  assert.equal(res.code,200);
  assert.equal(res.payload.ranking[0].activeParticipants,'1');
  assert.equal(res.payload.ranking[0].historicalParticipants,'3');
  assert.equal(res.payload.ranking[0].creditedSeconds,'999');
  assert.equal(res.payload.geography,'unavailable');
  assert.equal(res.headers['Cache-Control'],'no-store');
  assert.equal('visitorId' in res.payload.ranking[0],false);
  assert.equal('latitude' in res.payload.ranking[0],false);
});

test('Activity route never accepts writes and is disabled by default', async () => {
  const wrongMethod = response();
  await route('activity', stub())(request('POST',{}),wrongMethod);
  assert.equal(wrongMethod.code,405);
  process.env.WP_API_ENABLED='false';
  try {
    const blocked = response();
    await route('activity', stub())({method:'GET',headers:{}},blocked);
    assert.equal(blocked.code,503);
    assert.equal(blocked.payload.error,'participation_disabled');
  } finally {
    process.env.WP_API_ENABLED='true';
  }
});

test('Taps cannot cross anonymous cookie rotation even if tag ID was valid', async () => {
  const token=newSession().token;
  let called=false;
  const req=request('POST',{tagId:randomUUID(),batchId:randomUUID(),clicks:1});
  req.headers.cookie='wp_session='+token;
  req.headers['x-wp-session-binding']='f'.repeat(64);
  const res=response();
  await route('taps',stub({creditBatch:async()=>{called=true;}}))(req,res);
  assert.equal(res.code,409);
  assert.equal(res.payload.error,'session_binding_mismatch');
  assert.equal(called,false,'must reject BEFORE the database credit function');
});

test('New sessions return a non-authenticating queue binding and current hashtag metadata',async()=>{
  const token=newSession().token;
  const selected=randomUUID();
  const res=response();
  await route('session',stub({
    findVisitor:async()=>({id:randomUUID(),active_tag_id:selected,
      active_tag_name:'gta6',active_tag_color:'#ff8758'})
  }))({...request('POST',{}),headers:{
    ...request('POST',{}).headers,cookie:'wp_session='+token
  }},res);
  assert.equal(res.code,200);
  assert.equal(res.payload.sessionFresh,false);
  assert.equal(res.payload.activeTag.id,selected);
  assert.equal(res.payload.activeTag.name,'#gta6');
  assert.equal(res.payload.activeTag.color,'#ff8758');
  assert.equal(res.payload.sessionBinding,tokenHash('world-pulse-queue-binding-v1:'+token));
  assert.equal('visitorId' in res.payload,false);
  assert.equal('sessionToken' in res.payload,false);
});

test('country geography is separately gated and session rejects invalid consent before identity writes',async()=>{
 const res=response();await route('countries',stub())({method:'GET',headers:{}},res);
 assert.equal(res.code,503);assert.equal(res.payload.error,'geography_disabled');
 let touched=false;const invalid=response();
 await route('session',stub({findVisitor:async()=>{touched=true;}}))(request('POST',{geoConsent:'yes'}),invalid);
 assert.equal(invalid.code,400);assert.equal(touched,false);
});

test('country consent uses attested edge metadata, never client JSON country/coordinates',async()=>{
 const prior={...process.env};
 Object.assign(process.env,{VERCEL:'1',WP_GEO_COUNTRY_ENABLED:'true',WP_GEO_DIRECT_EDGE:'true'});
 let consent=false;
 try{
  const req=request('POST',{geoConsent:true,country:'BR',latitude:10,longitude:20});req.headers['x-vercel-ip-country']='PT';
  const res=response();
  await route('session',stub({
   findVisitor:async()=>({id:'visitor',active_tag_id:null,country_consent:false}),
   setCountryConsent:async(_id,allowed,country)=>{consent=allowed;assert.equal(country,'PT');},
   requireVisitor:async()=>({id:'visitor',active_tag_id:null,country_consent:consent,country_code:'PT'})
  }))(req,res);
  assert.equal(res.code,200);assert.equal(res.payload.geoConsent,true);assert.equal(res.payload.geoCountry,'PT');
  assert.equal('latitude'in res.payload,false);assert.equal('longitude'in res.payload,false);
 }finally{for(const key of ['VERCEL','WP_GEO_COUNTRY_ENABLED','WP_GEO_DIRECT_EDGE']){if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key];}}
});
