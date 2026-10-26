// HTTP virtual tabs against a FIXED disposable loopback database, never a cloud target.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {availableParallelism,totalmem,cpus} from 'node:os';
import pg from 'pg';
import * as store from '../server/store.mjs';
import {route} from '../server/handlers.mjs';
import {OPERATION_BUDGETS} from '../server/costPolicy.mjs';
import {capacityConfiguration,pathsFor,tabCounts,summarizeRequests} from './capacity-model.mjs';
const origin='http://127.0.0.1:4180';
const configuration=capacityConfiguration(process.env);
const owner=new pg.Pool({connectionString:'postgresql://postgres:local-only@127.0.0.1:5432/world_pulse_capacity',ssl:false,max:1});
const app=new pg.Pool({connectionString:'postgresql://world_pulse_app:local-only@127.0.0.1:5432/world_pulse_capacity',ssl:false,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:5000,query_timeout:6000});
let server,stage='setup';
const freshCounters=()=>({sqlCalls:0,transactions:0,budgetMutations:0,budgetRowsUpdated:0,snapshotBuilds:0,rankingBuilds:0,cacheHits:0,maxPoolWaiting:0});
let counters=freshCounters();
const instrumented={async connect(){
  const pending=app.connect();counters.maxPoolWaiting=Math.max(counters.maxPoolWaiting,app.waitingCount);
  const client=await pending;
  return {release:()=>client.release(),async query(text,values){
    counters.sqlCalls++;if(/^BEGIN/.test(text))counters.transactions++;
    if(text.includes('INSERT INTO world_pulse.operation_budgets'))counters.budgetMutations++;
    if(text.includes('GROUP BY v.region_cell'))counters.snapshotBuilds++;
    if(text.includes('WITH snapshot AS'))counters.rankingBuilds++;
    const result=await client.query(text,values);
    if(text.includes('INSERT INTO world_pulse.operation_budgets'))counters.budgetRowsUpdated+=result.rowCount;
    if(text.startsWith('SELECT payload FROM world_pulse.region_snapshot_cache')&&result.rowCount)counters.cacheHits++;
    return result;
  }};
}};
async function waitUntil(at){while(Date.now()<at)await new Promise(r=>setTimeout(r,Math.min(1000,at-Date.now())));}
async function request(path){
  const start=performance.now();
  try{
    const response=await fetch(origin+path,{signal:AbortSignal.timeout(15000)}),body=await response.text();
    const value=JSON.parse(body);
    if(response.ok&&(path==='/api/regions'?value.cells?.length!==1000:value.ranking?.length!==10))throw new Error('capacity_payload_invalid');
    const safe=['operation_budget_exhausted','operation_budget_unavailable','geography_refreshing','geography_capacity','internal_error'];
    return {ms:performance.now()-start,status:response.status,bytes:Buffer.byteLength(body),error:response.ok?undefined:safe.includes(value.error)?value.error:'unexpected_response'};
  }catch{return {ms:performance.now()-start,status:0,bytes:0,error:'transport_or_contract_failure'};}
}
try{
  const {rows:[existing]}=await owner.query("SELECT EXISTS(SELECT FROM pg_namespace WHERE nspname='world_pulse') AS present");
  if(existing.present)throw new Error('capacity_database_not_empty');
  stage='migrations';await owner.query("CREATE ROLE world_pulse_app LOGIN PASSWORD 'local-only' NOINHERIT");
  for(const name of ['0001-runtime-access','0002-participation-core','0003-time-balances','0004-operation-budgets','0005-retention-rollups','0006-country-geography','0007-regional-points','0008-one-km-regions'])await owner.query(await readFile(new URL('../infra/sql/'+name+'.sql',import.meta.url),'utf8'));
  const tags=Array.from({length:10},()=>randomUUID()),visitors=Array.from({length:1000},()=>randomUUID());
  stage='seed_tags';await owner.query("INSERT INTO world_pulse.tags(id,normalized,color) SELECT id,'capacity_'||(n-1),'#abcdef' FROM unnest($1::uuid[]) WITH ORDINALITY AS seed(id,n)",[tags]);
  stage='seed_visitors';await owner.query("INSERT INTO world_pulse.visitors(id,session_hash,expires_at,country_consent,country_consent_at,region_cell,region_shared_at) SELECT id,md5(id::text)||md5(id::text),now()+interval '1 day',true,now(),'r2:10000:'||floor((n-1)/10),now() FROM unnest($1::uuid[]) WITH ORDINALITY AS seed(id,n)",[visitors]);
  stage='seed_balances';await owner.query("INSERT INTO world_pulse.visitor_tags(visitor_id,tag_id,seconds,expires_at) SELECT id,($2::uuid[])[((n-1)%10)+1],3600,now()+interval '1 hour' FROM unnest($1::uuid[]) WITH ORDINALITY AS seed(id,n)",[visitors,tags]);
  process.env.NODE_ENV='test';store.useTestPool(instrumented);process.env.WP_API_ENABLED='true';process.env.WP_GEO_PUBLIC_ENABLED='true';
  const handlers=Object.fromEntries(['regions','ranking'].map(kind=>['/api/'+kind,route(kind)]));
  server=createServer(async(req,res)=>{
    const handler=handlers[req.url];if(!handler){res.statusCode=404;res.end();return;}
    await handler(req,{setHeader:(...args)=>res.setHeader(...args),status(code){res.statusCode=code;return this;},end:value=>res.end(value)});
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4180,'127.0.0.1',resolve);});
  if((await request('/api/regions')).status!==200||(await request('/api/ranking')).status!==200)throw new Error('capacity_fixture_invalid');
  const results=[],paths=pathsFor(configuration.profile);
  const cases=configuration.mode==='burst'?tabCounts.flatMap(tabs=>[1,2,3].map(repeat=>({tabs,repeat}))):tabCounts.map(tabs=>({tabs}));
  for(const scenario of cases){
    stage='scenario';counters=freshCounters();
    let start=Date.now();
    if(configuration.mode==='cadence'){start=Math.ceil((Date.now()+500)/60000)*60000+250;await waitUntil(start);}
    await owner.query('TRUNCATE world_pulse.operation_budgets,world_pulse.region_snapshot_cache');
    const samples=[];let maxScheduleDelayMs=0;
    const rounds=configuration.mode==='cadence'?12:1;
    for(let round=0;round<rounds;round++){
      const planned=start+round*5000;await waitUntil(planned);maxScheduleDelayMs=Math.max(maxScheduleDelayMs,Date.now()-planned);
      samples.push(...await Promise.all(Array.from({length:scenario.tabs},()=>paths.map(request)).flat()));
    }
    const {rows:budgets}=await owner.query('SELECT scope,used FROM world_pulse.operation_budgets ORDER BY scope');
    const row={...scenario,rounds,windowStart:new Date(start).toISOString(),completedAt:new Date().toISOString(),withinMinute:Date.now()<Math.floor(start/60000)*60000+60000,maxScheduleDelayMs,...summarizeRequests(samples),sql:{...counters},budgets};
    results.push(row);console.log(JSON.stringify({profile:configuration.profile,mode:configuration.mode,...row}));
  }
  stage='report';const {rows:[version]}=await owner.query("SELECT current_setting('server_version_num')::int AS postgres");
  const report={version:1,sha:process.env.GITHUB_SHA??null,configuration,environment:{node:process.version,postgres:version.postgres,cpu:cpus()[0]?.model,logicalCpus:availableParallelism(),memoryBytes:totalmem(),poolMax:3},dataset:{synthetic:true,visitors:1000,tags:10,regionTagGroups:1000},operationBudgets:OPERATION_BUDGETS,results,limitations:['HTTP virtual tabs; no browser/GPU/physical device measurement','Single local Node instance and PostgreSQL; not Vercel/Neon billing, network or autoscaling','GET requests only; no session creation or taps','Decoded JSON bytes exclude gzip, headers, TLS and transport overhead']};
  await mkdir('test-artifacts',{recursive:true});await writeFile(`test-artifacts/capacity-${configuration.profile}-${configuration.mode}.json`,JSON.stringify(report,null,2));
  if(results.some(row=>row.statuses[0]||row.statuses[500]||row.errors.unexpected_response||!row.withinMinute&&configuration.mode==='cadence'))throw new Error('capacity_run_invalid');
}catch(error){
  const code=/^[0-9A-Z]{5}$/.test(error.code??'')?error.code:/^capacity_[a-z_]+$/.test(error.message??'')?error.message:'suppressed';
  console.error(`Isolated capacity benchmark failed at ${stage} (${code}); database details suppressed.`);process.exitCode=1;
}
finally{if(server)await new Promise(resolve=>server.close(resolve));await app.end();await owner.end();}
