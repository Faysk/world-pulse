// Manual CI-only harness. Never imported by production routes or builds.
import {readFile} from 'node:fs/promises';
import {createServer as createHttpsServer} from 'node:https';
import pg from 'pg';
import {createServer} from 'vite';
import * as store from '../server/store.mjs';
import {route} from '../server/handlers.mjs';
import {validateStagingUrl,checkStaging} from '../infra/staging-db.mjs';
import {beginLimitedTransaction} from '../server/databaseLimits.mjs';
let pool,vite,https;
const createdVisitors=new Set();
async function cleanup(){
  if(vite)await vite.close();
  if(pool){
    if(createdVisitors.size){
      const client=await pool.connect();
      try{
        await beginLimitedTransaction(client);
        // Only synthetic identities created by THIS process, never broad cleanup.
        const removed=await client.query('DELETE FROM world_pulse.visitors WHERE id=ANY($1::uuid[])',[[...createdVisitors]]);
        if(removed.rowCount!==createdVisitors.size)throw new Error('synthetic_cleanup_count_mismatch');
        await client.query('DELETE FROM world_pulse.country_snapshot_cache');
        await client.query('COMMIT');
        console.log(`Staging smoke synthetic sessions cleaned: ${removed.rowCount}.`);
      }catch{await client.query('ROLLBACK');console.error('Staging smoke cleanup failed; temporary branch expires automatically.');}
      finally{client.release();}
    }
    await pool.end();
  }
}
try{
  if(process.env.WP_STAGING_SMOKE!=='1'||process.env.GITHUB_REF!=='refs/heads/codex/remote-staging'||
    process.env.GITHUB_REPOSITORY!=='Faysk/world-pulse'||process.env.DATABASE_MIGRATION_URL)throw new Error('staging_smoke_target_rejected');
  const connectionString=validateStagingUrl(process.env.DATABASE_URL);
  await checkStaging(connectionString);
  const [key,cert]=await Promise.all([readFile(process.env.WP_SMOKE_TLS_KEY),readFile(process.env.WP_SMOKE_TLS_CERT)]);
  pool=new pg.Pool({connectionString,max:3,connectionTimeoutMillis:5000,query_timeout:6000,allowExitOnIdle:true});
  process.env.NODE_ENV='test';store.useTestPool(pool);
  process.env.WP_API_ENABLED='true';process.env.WP_GEO_PUBLIC_ENABLED='true';
  process.env.WP_GEO_COUNTRY_ENABLED='false';process.env.WP_GEO_DIRECT_EDGE='false';
  const operations={...store,createVisitor:async()=>{
    const visitor=await store.createVisitor();createdVisitors.add(visitor.visitorId);return visitor;
  }};
  const handlers=Object.fromEntries(['session','tags','select','taps','ranking','activity','history','countries'].map(kind=>['/api/'+kind,route(kind,operations)]));
  vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'spa'});
  https=createHttpsServer({key,cert},async(req,res)=>{
    const handler=handlers[(req.url??'').split('?')[0]];
    if(!handler)return vite.middlewares(req,res);
    try{
      let body='';for await(const chunk of req){body+=chunk.toString();if(Buffer.byteLength(body)>8192){res.statusCode=413;res.end();return;}}
      req.body=body;
      await handler(req,{setHeader:(name,value)=>res.setHeader(name,value),status(code){res.statusCode=code;return this;},end:value=>res.end(value)});
    }catch{res.statusCode=500;res.end('{"error":"staging_harness_failure"}');}
  });
  await new Promise((resolve,reject)=>{https.once('error',reject);https.listen(4178,'127.0.0.1',resolve);});
  console.log('Staging HTTPS smoke ready on loopback only; pinned temporary Neon runtime, no deployment.');
  let closing=false;
  for(const signal of ['SIGTERM','SIGINT'])process.once(signal,async()=>{
    if(closing)return;closing=true;
    await new Promise(resolve=>https.close(resolve));
    try{await cleanup();process.exitCode=0;}catch{console.error('Staging smoke shutdown failed; details suppressed.');process.exitCode=1;}
  });
}catch{
  console.error('Staging HTTPS smoke startup refused or failed; private details suppressed.');
  try{await cleanup();}catch{}process.exitCode=1;
}
