import test from 'node:test';
import assert from 'node:assert/strict';
import {ParticipationClient} from '../src/participationClient.ts';
import {compactRegions,expandRegions} from '../server/regionWire.mjs';
import {route} from '../server/handlers.mjs';

const ranking={type:'active',asOfMs:1000,metric:'distinct_anonymous_sessions_with_positive_balance',geography:'unavailable',ranking:[]};
const region={type:'region_snapshot',asOfMs:1000,validUntilMs:6000,cells:[{cell:'r2:10000:1',tagId:'11111111-1111-4111-8111-111111111111',name:'#fixture',color:'#abcdef',participants:'1'}]};
test('overload pauses all aggregate reads, deduplicates flights, leaves writes independent and resumes at deadline',async()=>{
  let time=0,calls=0,blocked=true,release;
  const fetcher=async(path)=>{
    calls++;
    if(path==='/api/location')return Response.json({regionCell:null});
    if(blocked)return new Response('temporary proxy limit',{status:429,headers:{'Retry-After':'60'}});
    await new Promise(resolve=>{release=resolve;});return Response.json(ranking);
  };
  const client=new ParticipationClient(fetcher,null,()=>'',()=>time);
  await assert.rejects(client.ranking(),error=>error.retryAfterMs===60000);
  for(time=1000;time<60000;time+=1000){
    await assert.rejects(time%2000?client.regions():client.ranking(),/read_backoff/);
    await assert.rejects(client.countries(),/read_backoff/);
  }
  assert.equal(calls,1,'focus, mutation and panel refresh cannot bypass cooldown');
  await client.setRegionalCell(null);assert.equal(calls,2,'withdrawal is not blocked by read cooldown');
  blocked=false;time=60000;
  const first=client.ranking(),second=client.ranking();release();
  assert.deepEqual(await first,ranking);assert.deepEqual(await second,ranking);assert.equal(calls,3);
});
test('network failures exponentially back off and HTTP-date Retry-After is honored',async()=>{
  let time=0,calls=0;
  const client=new ParticipationClient(async()=>{calls++;throw new TypeError('offline');},null,()=>'',()=>time);
  await assert.rejects(client.ranking(),/offline/);time=4999;await assert.rejects(client.ranking(),/read_backoff/);
  time=5000;await assert.rejects(client.ranking(),/offline/);time=14999;await assert.rejects(client.ranking(),/read_backoff/);
  time=15000;await assert.rejects(client.ranking(),/offline/);assert.equal(calls,3);
  const until=new Date(Date.now()+120000).toUTCString();
  const dated=new ParticipationClient(async()=>new Response('',{status:503,headers:{'Retry-After':until}}),null);
  await assert.rejects(dated.ranking(),error=>error.retryAfterMs>118000&&error.retryAfterMs<=120000);
});
test('compact regions roundtrip large counts, reject malformed indices, and remove repeated metadata',async()=>{
  const snapshot={...region,cells:Array.from({length:1000},(_,i)=>({...region.cells[0],cell:`r2:10000:${i}`,participants:'123456789012345678901234567890',tagId:`11111111-1111-4111-8111-${String(i%10).padStart(12,'0')}`}))};
  const compact=compactRegions(snapshot);
  assert.deepEqual(expandRegions(compact),snapshot);
  const legacyBytes=Buffer.byteLength(JSON.stringify(snapshot)),compactBytes=Buffer.byteLength(JSON.stringify(compact));
  assert.ok(compactBytes<legacyBytes*.5);
  console.log(JSON.stringify({syntheticGroups:1000,legacyBytes,compactBytes}));
  for(const index of [-1,10,1.5,'0',null])assert.throws(()=>expandRegions({...compact,cells:[['r2:10000:1',index,'1']]}),/invalid_region_snapshot/);
  const client=new ParticipationClient(async(_path,init)=>{
    assert.equal(init.headers['X-WP-Region-Format'],'compact-v1');return Response.json(compactRegions(region));
  },null);
  assert.deepEqual(await client.regions(),region);
  const oldServer=new ParticipationClient(async()=>Response.json(region),null);
  assert.deepEqual(await oldServer.regions(),region,'new client accepts legacy server');
});
test('compact wire format is opt-in and all responses remain no-store',async()=>{
  process.env.WP_API_ENABLED='true';process.env.WP_GEO_PUBLIC_ENABLED='true';
  for(const format of [undefined,'compact-v1']){
    const budgets=[];const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},end(body){this.body=JSON.parse(body);}};
    await route('regions',{consumeApiBudget:async category=>budgets.push(category??'requests'),getRegionSnapshot:async()=>region})({method:'GET',headers:{'x-wp-region-format':format}},res);
    assert.equal(res.code,200);assert.equal(res.headers['Cache-Control'],'no-store');
    assert.deepEqual(budgets,['requests','reads']);
    assert.deepEqual(res.body,format?compactRegions(region):region,'old client still gets original shape');
  }
});
