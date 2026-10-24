import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ParticipationClient } from '../src/participationClient.ts';

const ID_A = randomUUID();
const ID_B = randomUUID();
const SESSION_BINDING = 'a'.repeat(64);
const OLD_BINDING = 'b'.repeat(64);

function fakeStorage() {
  const map = new Map();
  return {
    getItem: name => map.get(name) ?? null,
    setItem: (name, value) => { map.set(name, value); }
  };
}
function mockTransport({ failOnce = false, loseResponseOnce = false, clock = () => 1000 } = {}) {
  const calls = [];
  const credited = new Map();
  const accepted = new Map();
  const balances = new Map();
  let activeTagId = null;
  let shouldFail = failOnce;
  const handle = async (path, init) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, body });
    if (path === '/api/session') return Response.json({
      anonymous:true,sessionFresh:false,sessionBinding:SESSION_BINDING,
      activeTagId,activeTag:activeTagId?{id:activeTagId,
        name:activeTagId===ID_A?'#gta6':'#lofi',color:'#aabbcc'}:null,
      credits:[...balances.values()].map(b=>({
        ...b,serverNowMs:clock(),remainingMs:Math.max(0,b.expiresAtMs-clock())
      }))
    });
    if (path === '/api/tags') {
      const a = body.name.toLowerCase().includes('gta');
      return Response.json({ tag: { id: a ? ID_A : ID_B, color: a ? '#ffffff' : '#123456', name: a ? '#gta6' : '#lofi' } });
    }
    if (path === '/api/select') { activeTagId=body.tagId; return Response.json({activeTagId}); }
    if (path === '/api/history') return Response.json({ type: 'historical', ranking: [] });
    if (path === '/api/ranking') return Response.json({type:'active',asOfMs:clock(),metric:'distinct_anonymous_sessions_with_positive_balance',geography:'unavailable',ranking:[]});
    if (path === '/api/taps') {
      if (shouldFail) { shouldFail = false; throw new Error('network-failure'); }
      const existing = accepted.get(body.batchId);
      if (existing) {
        assert.deepEqual(existing, body, 'retry must have an identical payload');
      } else {
        accepted.set(body.batchId, body);
        credited.set(body.tagId, (credited.get(body.tagId) || 0) + body.clicks);
        const oldBalance=balances.get(body.tagId);
        balances.set(body.tagId,{
          tagId:body.tagId,
          creditedSeconds:String(credited.get(body.tagId)),
          expiresAtMs:Math.max(oldBalance?.expiresAtMs??0,clock())+body.clicks*1000
        });
      }
      if (loseResponseOnce) { loseResponseOnce = false; throw new Error('response-lost'); }
      const balance=balances.get(body.tagId);
      return Response.json({batchId:body.batchId,duplicate:Boolean(existing),...balance,
        serverNowMs:clock(),remainingMs:Math.max(0,balance.expiresAtMs-clock())});
    }
    throw new Error('unexpected API route ' + path);
  };
  return { handle, calls, credited, accepted };
}

test('Queued +1 taps are grouped into bounded idempotent batches', async () => {
  const storage = fakeStorage(), transport = mockTransport();
  const client = new ParticipationClient(transport.handle, storage, randomUUID);
  assert.equal(await client.creditClick(), false, 'no active tag');
  await client.selectTag('#GTA6');
  for (let i=0; i<65; i++) assert.equal(await client.creditClick(), true);
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
  for (let i=0; i<4; i++) await client.creditClick();
  await assert.rejects(() => client.flush(), /network-failure/);
  const pending = JSON.parse(storage.getItem('world-pulse-pending-v1')).batches;
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
  await client.creditClick();
  await client.selectTag('#LoFi');
  await client.creditClick();
  await client.flush();
  assert.equal(transport.credited.get(ID_A), 1);
  assert.equal(transport.credited.get(ID_B), 1);
  await client.clearSelection();
  assert.equal(await client.creditClick(), false);
});

test('New taps after a lost response never change the already accepted batch fingerprint', async () => {
  const storage = fakeStorage(), transport = mockTransport({loseResponseOnce:true});
  const client = new ParticipationClient(transport.handle,storage,randomUUID);
  await client.selectTag('#GTA6');
  for(let i=0;i<4;i++) await client.creditClick();
  await assert.rejects(client.flush(),/response-lost/);
  for(let i=0;i<2;i++) await client.creditClick();
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
  await original.creditClick();
  await assert.rejects(original.flush(),/response-lost/);
  const restored = new ParticipationClient(transport.handle,storage,randomUUID);
  await restored.selectTag('#GTA6');
  await restored.creditClick();
  await restored.flush();
  assert.equal(transport.credited.get(ID_A),2);
  assert.equal(restored.pendingClicks(),0);
});

test('Current ranking and historical participation are distinct API contracts', async () => {
  const transport = mockTransport(), client = new ParticipationClient(transport.handle, fakeStorage());
  const current = await client.ranking();
  assert.equal(current.type,'active');
  assert.equal(current.metric,'distinct_anonymous_sessions_with_positive_balance');
  const result = await client.historicalRanking();
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
  const client = new ParticipationClient(async () => Response.json({anonymous:true,sessionFresh:false,sessionBinding:SESSION_BINDING,activeTagId:ID_A,activeTag:null,credits}),fakeStorage(),randomUUID);
  await client.connect();
  assert.deepEqual(client.balances(),credits);
  assert.equal(await client.creditClick(),true);
  const copy = client.balances();
  copy[0].remainingMs=0;
  assert.equal(client.balances()[0].remainingMs,8000);
});

test('Each balance counts down on its own monotonic clock, including while topping up another tag', async () => {
  let elapsed=100000;
  const transport=mockTransport({clock:()=>elapsed});
  const client=new ParticipationClient(transport.handle,fakeStorage(),randomUUID,()=>elapsed);
  await client.selectTag('#GTA6');for(let i=0;i<4;i++)await client.creditClick();await client.flush();
  assert.equal(client.remainingMilliseconds(ID_A),4000);
  elapsed+=1500;
  await client.selectTag('#LoFi');for(let i=0;i<4;i++)await client.creditClick();await client.flush();
  assert.equal(client.remainingMilliseconds(ID_A),2500);
  assert.equal(client.remainingMilliseconds(ID_B),4000);
  elapsed+=3000;
  assert.equal(client.remainingMilliseconds(ID_A),0);
  assert.equal(client.remainingMilliseconds(ID_B),1000);
});

test('New anonymous session quarantines pending clicks instead of replaying as another visitor', async () => {
  const storage=fakeStorage();
  const oldBatch={batchId:randomUUID(),tagId:ID_A,clicks:3};
  storage.setItem('world-pulse-pending-v1',JSON.stringify({version:2,binding:OLD_BINDING,batches:[oldBatch]}));
  const calls=[];
  const fetcher=async(path,init)=>{
    calls.push({path,body:init.body && JSON.parse(init.body)});
    if(path==='/api/session') return Response.json({
      anonymous:true,sessionFresh:true,sessionBinding:SESSION_BINDING,activeTagId:null,activeTag:null,credits:[]
    });
    throw new Error('orphaned batch was incorrectly replayed to a new session');
  };
  const client=new ParticipationClient(fetcher,storage,randomUUID);
  await assert.rejects(client.connect(),/session_rotated_pending/);
  assert.equal(client.isQuarantined(),true);
  assert.equal(await client.creditClick(),false);
  await assert.rejects(client.flush(),/session_rotated_pending/);
  assert.deepEqual(JSON.parse(storage.getItem('world-pulse-pending-v1')).batches,[oldBatch]);
  assert.equal(calls.some(x=>x.path==='/api/taps'),false);

  // Reloading the page must not silently retry an already quarantined queue.
  const refreshed=new ParticipationClient(fetcher,storage,randomUUID);
  await assert.rejects(refreshed.connect(),/session_rotated_pending/);
  assert.equal(refreshed.pendingClicks(),3);
  await refreshed.discardOrphanedPending();
  assert.equal(refreshed.isQuarantined(),false);
  assert.equal(refreshed.pendingClicks(),0);
  await refreshed.connect();
});

test('An expired session during flush blocks old pending batches and does not rewrite them', async () => {
  const storage=fakeStorage(),batchId=randomUUID();
  let expired=false;
  const transport=async(path,init)=>{
    if(path==='/api/session') return Response.json({
      anonymous:true,sessionFresh:false,sessionBinding:SESSION_BINDING,activeTagId:ID_A,
      activeTag:{id:ID_A,name:'#gta6',color:'#ff8758'},credits:[]
    });
    if(path==='/api/taps'){
      if(!expired){expired=true;return Response.json({error:'session_expired'},{status:401});}
      throw new Error('must never replay after expiry');
    }
    throw new Error('unexpected request '+path);
  };
  const client=new ParticipationClient(transport,storage,()=>batchId);
  await client.connect();
  await client.creditClick();
  await assert.rejects(client.flush(),/session_expired/);
  assert.equal(client.isQuarantined(),true);
  assert.equal(client.pendingClicks(),1);
  await assert.rejects(client.flush(),/session_rotated_pending/);
});

test('Tabs converge on authoritative server selection after notification, not guessed local state', async () => {
  const storage=fakeStorage();
  let current=null;
  const server=async(path,init)=>{
    const body=init.body?JSON.parse(init.body):null;
    if(path==='/api/session')return Response.json({
      anonymous:true,sessionFresh:false,sessionBinding:SESSION_BINDING,activeTagId:current,
      activeTag:current?{id:current,name:current===ID_A?'#gta6':'#lofi',color:'#aabbcc'}:null,
      credits:[]
    });
    if(path==='/api/tags')return Response.json({tag:{
      id:body.name==='#GTA6'?ID_A:ID_B,name:body.name.toLowerCase(),color:'#aabbcc'
    }});
    if(path==='/api/select'){current=body.tagId;return Response.json({activeTagId:current});}
    throw new Error('Unexpected request');
  };
  const a=new ParticipationClient(server,storage,randomUUID);
  const b=new ParticipationClient(server,storage,randomUUID);
  await Promise.all([a.connect(),b.connect()]);
  await a.selectTag('#GTA6');
  assert.equal(b.selection(),null);
  await b.refreshSession();
  assert.equal(b.selection(),ID_A);
  assert.equal(b.selectedTagDetails()?.name,'#gta6');
  await b.selectTag('#LoFi');
  await a.refreshSession();
  assert.equal(a.selection(),ID_B);
  assert.equal(a.selectedTagDetails()?.name,'#lofi');
  await a.clearSelection();
  await b.refreshSession();
  assert.equal(b.selection(),null);
  assert.equal(await b.creditClick(),false);
  assert.ok(storage.getItem('world-pulse-selection-changed-v1'));
});

test('A different tab may rotate the cookie before our request, but queue binding still prevents replay',async()=>{
  const storage=fakeStorage();
  const original={batchId:randomUUID(),tagId:ID_A,clicks:2};
  storage.setItem('world-pulse-pending-v1',JSON.stringify({
    version:2,binding:OLD_BINDING,batches:[original]
  }));
  const calls=[];
  const fetcher=async(path)=>{
    calls.push(path);
    if(path==='/api/session') return Response.json({
      anonymous:true,sessionFresh:false,sessionBinding:SESSION_BINDING,
      activeTagId:ID_A,activeTag:{id:ID_A,name:'#gta6',color:'#ff8758'},credits:[]
    });
    throw new Error('Old queue must not be submitted under a new cookie');
  };
  const client=new ParticipationClient(fetcher,storage,randomUUID);
  await assert.rejects(client.flush(),/session_rotated_pending/);
  assert.equal(client.isQuarantined(),true);
  assert.equal(client.pendingClicks(),2);
  assert.deepEqual(calls,['/api/session']);
  assert.deepEqual(JSON.parse(storage.getItem('world-pulse-pending-v1')).batches,[original]);
});

test('Concurrent clients never overwrite a shared queue or resurrect acknowledged batches', async () => {
  const storage=fakeStorage(), transport=mockTransport();
  const a=new ParticipationClient(transport.handle,storage,randomUUID);
  const b=new ParticipationClient(transport.handle,storage,randomUUID);
  await a.selectTag('#GTA6'); await b.refreshSession();
  await Promise.all(Array.from({length:60},(_,i)=>(i%2?a:b).creditClick()));
  await a.refreshPending(); await b.refreshPending();
  assert.equal(a.pendingClicks(),60); assert.equal(b.pendingClicks(),60);
  await Promise.all([a.flush(),b.flush()]);
  assert.equal(transport.credited.get(ID_A),60);
  assert.equal(JSON.parse(storage.getItem('world-pulse-pending-v1')).batches.length,0);
  await b.creditClick(); await a.flush(); await b.refreshPending();
  assert.equal(transport.credited.get(ID_A),61);
  assert.equal(b.pendingClicks(),0);
});

test('Another writer waits for in-flight batch, then preserves its frozen ID after a lost response', async () => {
  const storage=fakeStorage(), transport=mockTransport({loseResponseOnce:true});
  let release, entered;
  const gate=new Promise(resolve=>release=resolve);
  const reached=new Promise(resolve=>entered=resolve);
  const handle=async(path,init)=>{
    if(path==='/api/taps'){entered();await gate;}
    return transport.handle(path,init);
  };
  const a=new ParticipationClient(handle,storage,randomUUID);
  const b=new ParticipationClient(handle,storage,randomUUID);
  await a.selectTag('#GTA6'); await b.refreshSession(); await a.creditClick();
  const sending=a.flush();
  await reached;
  const durable=JSON.parse(storage.getItem('world-pulse-pending-v1'));
  assert.deepEqual(durable.sealed,[durable.batches[0].batchId]);
  let wrote=false;
  const addition=b.creditClick().then(()=>{wrote=true;});
  await Promise.resolve(); assert.equal(wrote,false);
  release(); await assert.rejects(sending,/response-lost/); await addition;
  const after=JSON.parse(storage.getItem('world-pulse-pending-v1'));
  assert.equal(after.batches.length,2);
  assert.deepEqual(after.batches[0],durable.batches[0]);
  await b.flush();
  assert.equal(transport.credited.get(ID_A),2);
});

test('Storage write failures are explicit, never reported as a durable accepted tap', async () => {
  const storage=fakeStorage(), transport=mockTransport();
  const client=new ParticipationClient(transport.handle,storage,randomUUID);
  await client.selectTag('#GTA6');
  storage.setItem=()=>{throw new Error('quota');};
  await assert.rejects(()=>client.creditClick(),/queue_storage_unavailable/);
  assert.equal(transport.credited.size,0);
});

test('Malformed ranking snapshots fail explicitly instead of crashing bigint/date rendering',async()=>{
  const valid={type:'active',metric:'distinct_anonymous_sessions_with_positive_balance',geography:'unavailable',asOfMs:1000,ranking:[]};
  for(const snapshot of [{...valid,asOfMs:null},{...valid,asOfMs:9e15},{...valid,ranking:[{id:ID_A,name:'#gta6',color:'#ffffff',activeParticipants:'invalid',historicalParticipants:'1',creditedSeconds:'1'}]},{...valid,ranking:null}]){
    const client=new ParticipationClient(async()=>Response.json(snapshot),null);
    await assert.rejects(()=>client.ranking(),/invalid_ranking_snapshot/);
  }
});
