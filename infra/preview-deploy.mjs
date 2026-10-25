import {appendFile} from 'node:fs/promises';
import {setTimeout} from 'node:timers/promises';
import pg from 'pg';
import {previewTeam} from './preview-config.mjs';
import {deployPreview} from './preview-deployment.mjs';
import {smokeStaticSite,SmokeCheckError} from './staged-release.mjs';
import {smokePreviewApi} from './preview-api-smoke.mjs';
import {validateStagingUrl} from './staging-db.mjs';
import {beginLimitedTransaction} from '../server/databaseLimits.mjs';
import {vercelApi} from './vercel-api.mjs';
const hashes=new Set();let pool,cleaned=0;
try{
  const connectionString=validateStagingUrl(process.env.DATABASE_URL);
  pool=new pg.Pool({connectionString,max:1,connectionTimeoutMillis:15000,query_timeout:6000});
  const result=await deployPreview({api:vercelApi({token:process.env.VERCEL_TOKEN,team:previewTeam}),env:process.env,pause:setTimeout,
    receipt:id=>console.log(`Isolated preview: ${id}`),progress:message=>console.log(message),
    smoke:async(origin,secret)=>{
      for(let attempt=0;;attempt++){
        try{await smokeStaticSite(origin,secret,fetch,{ignorePreviewToolbar:true});break;}catch(error){if(attempt>=3)throw error;await setTimeout(2000);}
      }
      console.log('Preview HTML/JS/CSS passed; testing API sessions.');
      await smokePreviewApi(origin,secret,hashes,fetch,{countrySource:process.env.WP_PREVIEW_GEO_COUNTRY_ENABLED==='true'});
      if(process.env.WP_PREVIEW_GEO_COUNTRY_ENABLED==='true')console.log('Country estimate available; client country/forwarded-IP spoof attempt did not change it. No raw IP recorded.');
    }});
  console.log('Preview HTTPS HTML/assets, two sessions, secure cookies, balances, idempotent retry, return and consent passed. Temporary access revoked.');
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`Protected staging preview: ${result.origin}\nCommit: ${result.sha}\nDeployment: ${result.id}\nHTTPS/API smoke passed. Temporary test access revoked; production unchanged.\n`);
}catch(error){
  console.error('Staging preview deployment or smoke failed; provider bodies, cookies, bindings and credentials suppressed. No promotion or production mutation.');
  if(error instanceof SmokeCheckError)console.error(`Safe static smoke failure: ${error.message}`);
  if(/^preview_http_[0-9]{3}$/.test(error?.message??''))console.error(error.message);
  if(error?.name==='AssertionError')console.error('Preview API contract assertion failed.');
  if(['TimeoutError','AbortError','TypeError'].includes(error?.name))console.error(`Safe failure category: ${error.name}`);
  if(Number.isInteger(error?.providerStatus))console.error(`Provider HTTP status: ${error.providerStatus}`);
  if(['preview_deploy_rejected','preview_receipt_rejected','preview_build_failed','preview_build_timeout','preview_access_missing'].includes(error?.message))console.error(error.message);
  process.exitCode=1;
}finally{
  if(pool){
    try{
      if(hashes.size){
        const db=await pool.connect();
        try{
          await beginLimitedTransaction(db);await db.query('SELECT pg_advisory_xact_lock(1867401)');
          const result=await db.query('DELETE FROM world_pulse.visitors WHERE session_hash::text=ANY($1::text[])',[[...hashes]]);
          if(result.rowCount!==hashes.size)throw new Error('preview_cleanup_count');
          await db.query('DELETE FROM world_pulse.country_snapshot_cache');await db.query('COMMIT');cleaned=result.rowCount;
        }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
      }
      console.log(`Preview synthetic sessions cleaned: ${cleaned}. Empty QA tags/budget counters may remain in the expiring staging branch.`);
    }catch{console.error('Preview fixture cleanup failed; investigate the temporary staging branch.');process.exitCode=1;}
    await pool.end();
  }
}
