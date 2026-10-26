import test from 'node:test';
import assert from 'node:assert/strict';
import {previewConfiguration,syncPreviewConfiguration,previewBranch,previewProject,checkPreviewCredential} from './preview-config.mjs';
const now=Date.parse('2026-10-24T02:00:00Z');
const env={GITHUB_REF:'refs/heads/codex/remote-staging',GITHUB_REPOSITORY:'Faysk/world-pulse',WP_PREVIEW_SYNC_ENABLED:'true',
  WP_PREVIEW_TOKEN_EXPIRES_AT:'2027-01-24T00:00:00Z',
  DATABASE_URL:'postgresql://world_pulse_app:disposable@ep-misty-glade-za9nxlhg-pooler.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full'};
test('preview config is branch-specific, staging-only, with sensitive runtime and geography source off',()=>{
  const config=previewConfiguration(env,now);
  assert.equal(config.find(item=>item.key==='DATABASE_URL').type,'sensitive');
  assert.equal(config.find(item=>item.key==='WP_GEO_COUNTRY_ENABLED').value,'false');
  for(const item of config){assert.deepEqual(item.target,['preview']);assert.equal(item.gitBranch,previewBranch);assert.ok(!item.key.includes('MIGRATION'));}
  for(const patch of [{GITHUB_REF:'refs/heads/main'},{GITHUB_REPOSITORY:'other/project'},{DATABASE_MIGRATION_URL:'forbidden'},
    {DATABASE_URL:env.DATABASE_URL.replace('world_pulse_app','neondb_owner')},
    {DATABASE_URL:env.DATABASE_URL.replace('ep-misty-glade-za9nxlhg','ep-production')}])assert.throws(()=>previewConfiguration({...env,...patch},now));
  assert.deepEqual(previewConfiguration(env,Date.parse('2027-01-01T00:00:00Z')),config);
});

test('credential renewal is required a week before expiry, before any provider mutation',async()=>{
  for(const value of ['', 'invalid', '2026-10-24T02:00:00Z', '2026-10-29T00:00:00Z']){
    const calls=[];
    await assert.rejects(syncPreviewConfiguration(async(...args)=>{calls.push(args);},{...env,WP_PREVIEW_TOKEN_EXPIRES_AT:value},now),/preview_credential/);
    assert.equal(calls.length,0);
  }
  assert.doesNotThrow(()=>checkPreviewCredential(env,now));
});
test('preview sync fails closed by default and never calls deployment or promotion endpoints',async()=>{
  const calls=[];const api=async(path,options)=>{calls.push({path,body:JSON.parse(options.body)});return {};};
  await assert.rejects(()=>syncPreviewConfiguration(api,{...env,WP_PREVIEW_SYNC_ENABLED:''},now),/preview_sync_disabled/);
  assert.equal(calls.length,0);
  await syncPreviewConfiguration(api,env,now);
  assert.equal(calls.length,1);assert.equal(calls[0].path,`/v10/projects/${previewProject}/env?upsert=true`);
  await assert.rejects(()=>syncPreviewConfiguration(async()=>({failed:[{}]}),env,now),/preview_sync_failed/);
});

test('preview country source requires a separate direct-edge attestation and keeps production untouched',()=>{
  assert.throws(()=>previewConfiguration({...env,WP_PREVIEW_GEO_COUNTRY_ENABLED:'true'},now),/preview_geo_unattested/);
  const config=previewConfiguration({...env,WP_PREVIEW_GEO_COUNTRY_ENABLED:'true',WP_PREVIEW_GEO_DIRECT_EDGE:'true'},now);
  assert.equal(config.find(row=>row.key==='WP_GEO_COUNTRY_ENABLED').value,'true');
  for(const row of config){assert.deepEqual(row.target,['preview']);assert.equal(row.gitBranch,previewBranch);}
});
