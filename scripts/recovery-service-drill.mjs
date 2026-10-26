// Synthetic only. Fixed loopback databases, no cloud credentials or real backup.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import pg from 'pg';
import {route} from '../server/handlers.mjs';
import * as store from '../server/store.mjs';
import {tokenHash,batchFingerprint} from '../server/protocol.mjs';
import {command} from '../infra/backup-runtime.mjs';
import {durableTables,transientTables,fingerprintSql,sealBackup,openBackup,maxArchiveBytes} from '../infra/backup-core.mjs';
import {recoveryPrivacySql,recoveryGrantsSql,recoveryFixtureContext} from '../infra/recovery-policy.mjs';
const container=recoveryFixtureContext(process.env),start=performance.now(),timings={};
const config=database=>({host:'127.0.0.1',port:5432,database,user:'postgres',password:'local-only',ssl:false,max:1});
const owner=new pg.Pool(config('world_pulse_recovery')),admin=new pg.Pool(config('postgres'));
let restored,runtime,server,stage='setup';
const mark=name=>{timings[name]=Math.round(performance.now()-start);};
const token=randomBytes(32).toString('base64url'),visitor=randomUUID(),tag=randomUUID(),expiredTag=randomUUID(),batch=randomUUID();
const origin='http://127.0.0.1:4181';
async function call(path,body){
  const response=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{cookie:'wp_session='+token,origin:'https://127.0.0.1:4181','Content-Type':'application/json','X-WP-Session-Binding':tokenHash('world-pulse-queue-binding-v1:'+token)},...(body===undefined?{}:{body:JSON.stringify(body)})});
  assert.equal(response.status,200);return response.json();
}
try{
  await owner.query('CREATE ROLE world_pulse_app LOGIN NOINHERIT PASSWORD \'local-only\'');
  for(const name of ['0001-runtime-access','0002-participation-core','0003-time-balances','0004-operation-budgets','0005-retention-rollups','0006-country-geography','0007-regional-points','0008-one-km-regions'])await owner.query(await readFile(new URL('../infra/sql/'+name+'.sql',import.meta.url),'utf8'));
  await owner.query("INSERT INTO world_pulse.tags(id,normalized,color) VALUES($1,'recover','#abcdef'),($2,'expired','#123456')",[tag,expiredTag]);
  await owner.query("INSERT INTO world_pulse.visitors(id,session_hash,active_tag_id,expires_at,country_consent,country_code,region_cell) VALUES($1,$2,$3,now()+interval '30 days',true,'PT','r2:10000:1')",[visitor,tokenHash(token),tag]);
  await owner.query("INSERT INTO world_pulse.visitor_tags(visitor_id,tag_id,seconds,expires_at) VALUES($1,$2,60,now()+interval '1 hour'),($1,$3,9,now()-interval '1 minute')",[visitor,tag,expiredTag]);
  await owner.query('INSERT INTO world_pulse.tap_batches(visitor_id,batch_id,tag_id,clicks,fingerprint) VALUES($1,$2,$3,3,$4)',[visitor,batch,tag,batchFingerprint(tag,3)]);
  await owner.query('INSERT INTO world_pulse.tag_history_totals(tag_id,participants,credited_seconds) VALUES($1,9,12345678901234567890)',[tag]);
  const tables=Object.fromEntries(await Promise.all(durableTables.map(async table=>[table,(await owner.query(fingerprintSql(table))).rows[0].fingerprint])));
  process.env.NODE_ENV='test';process.env.WP_API_ENABLED='true';process.env.WP_GEO_PUBLIC_ENABLED='true';
  runtime=new pg.Pool({...config('world_pulse_recovery'),user:'world_pulse_app',max:3});store.useTestPool(runtime);
  const routes=Object.fromEntries(['regions','ranking','session','taps','location'].map(kind=>['/api/'+kind,route(kind)]));
  server=createServer(async(req,res)=>{
    const handler=routes[req.url];if(!handler){res.statusCode=404;res.end();return;}
    const parts=[];for await(const part of req)parts.push(part);req.body=parts.length?JSON.parse(Buffer.concat(parts).toString()):{};
    await handler(req,{setHeader:(...args)=>res.setHeader(...args),status(code){res.statusCode=code;return this;},end:data=>res.end(data)});
  });
  await new Promise(resolve=>server.listen(4181,'127.0.0.1',resolve));
  assert.equal((await call('/api/regions')).cells.length,1);mark('sourceServiceVerifiedMs');
  stage='export';const args=['exec',container,'pg_dump','-U','postgres','-d','world_pulse_recovery','--format=custom','--schema=world_pulse','--no-acl','--no-owner'];
  for(const table of transientTables)args.push('--exclude-table-data=world_pulse.'+table);
  const archive=command(args,{maxBuffer:maxArchiveBytes}),key=randomBytes(32).toString('base64');
  const sealed=sealBackup(archive,{version:1,serverMajor:18,tables},key);mark('encryptedExportMs');
  stage='new_destination';await admin.query('CREATE DATABASE world_pulse_recovered');
  const opened=openBackup(sealed,key);
  command(['exec','-i',container,'pg_restore','-U','postgres','-d','world_pulse_recovered','--no-owner','--no-acl','--exit-on-error'],{input:opened.archive});
  restored=new pg.Pool(config('world_pulse_recovered'));
  for(const table of durableTables)assert.equal((await restored.query(fingerprintSql(table))).rows[0].fingerprint,tables[table]);
  stage='privacy_and_grants';await restored.query(recoveryPrivacySql);await restored.query(recoveryGrantsSql);mark('restoredAndSanitizedMs');
  assert.equal((await restored.query("SELECT count(*)::int AS n FROM world_pulse.visitors WHERE region_cell IS NOT NULL OR country_consent OR country_code<>'ZZ' OR country_consent_at IS NOT NULL OR region_shared_at IS NOT NULL")).rows[0].n,0);
  for(const table of durableTables.filter(t=>t!=='visitors'))assert.equal((await restored.query(fingerprintSql(table))).rows[0].fingerprint,tables[table]);
  stage='controlled_cutover';await runtime.end();await owner.end();
  await admin.query('DROP DATABASE world_pulse_recovery'); // fixed disposable source only
  runtime=new pg.Pool({...config('world_pulse_recovered'),user:'world_pulse_app',max:3});store.useTestPool(runtime);
  await assert.rejects(runtime.query('CREATE TABLE world_pulse.forbidden(id int)'),{code:'42501'});
  assert.equal((await call('/api/regions')).cells.length,0,'restored consent must never republish a point');
  const session=await call('/api/session',{});assert.equal(session.geoConsent,false);assert.equal(session.regionCell,null);
  const active=await call('/api/ranking');assert.equal(active.ranking.find(r=>r.id===tag).activeParticipants,'1');assert.equal(active.ranking.find(r=>r.id===expiredTag).activeParticipants,'0');
  const duplicate=await call('/api/taps',{batchId:batch,tagId:tag,clicks:3});assert.equal(duplicate.duplicate,true);
  assert.equal((await restored.query('SELECT seconds::text FROM world_pulse.visitor_tags WHERE visitor_id=$1 AND tag_id=$2',[visitor,tag])).rows[0].seconds,'60');
  await call('/api/taps',{batchId:randomUUID(),tagId:tag,clicks:1});
  assert.equal((await restored.query('SELECT seconds::text FROM world_pulse.visitor_tags WHERE visitor_id=$1 AND tag_id=$2',[visitor,tag])).rows[0].seconds,'61');
  await call('/api/location',{cell:'r2:10000:1'});assert.equal((await call('/api/regions')).cells.length,1);
  await call('/api/location',{cell:null});assert.equal((await call('/api/regions')).cells.length,0);mark('recoveredServiceVerifiedMs');
  const report={version:1,sha:process.env.GITHUB_SHA??null,synthetic:true,timings,encryptedBytes:sealed.length,checks:['durable_fingerprints','geography_reset','runtime_no_ddl','source_removed','http_session_ranking_taps','replay_idempotency','expired_balance_stays_expired','explicit_location_and_withdrawal'],limitations:['Local disposable database and HTTP service, not cloud/DNS/browser cutover RTO','No real backup, customer data, credentials or independent key custody tested','RPO depends on last verified real backup; acknowledged post-backup writes may be lost']};
  await mkdir('test-artifacts',{recursive:true});await writeFile('test-artifacts/recovery-service.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}catch{console.error(`Synthetic recovery service drill failed at ${stage}; data and credentials suppressed.`);process.exitCode=1;}
finally{await new Promise(resolve=>server?server.close(resolve):resolve());await runtime?.end().catch(()=>{});await restored?.end().catch(()=>{});await owner.end().catch(()=>{});await admin.end().catch(()=>{});}
