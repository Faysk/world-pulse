import test from 'node:test';
import assert from 'node:assert/strict';
import {deployPreview} from './preview-deployment.mjs';
import {previewProject,previewBranch} from './preview-config.mjs';
const now=Date.parse('2026-10-25T20:00:00Z');
const env={GITHUB_REF:'refs/heads/'+previewBranch,GITHUB_REPOSITORY:'Faysk/world-pulse',GITHUB_REPOSITORY_ID:'1431565257',GITHUB_SHA:'a'.repeat(40),WP_PREVIEW_SYNC_ENABLED:'true',VERCEL_TOKEN:'fake-token',
  DATABASE_URL:'postgresql://world_pulse_app:disposable@ep-misty-glade-za9nxlhg-pooler.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full'};
function fixture(patch={},fail=false,transient=0){
  const calls=[];const api=async(path,opts={})=>{const body=opts.body&&JSON.parse(opts.body);calls.push({path,body});
    if(path==='/v13/deployments')return {id:'dpl_fake'};
    if(path==='/v13/deployments/dpl_fake'&&transient-->0)throw Object.assign(new Error('transient'),{name:'TimeoutError'});
    if(path==='/v13/deployments/dpl_fake')return {readyState:'READY',target:null,projectId:previewProject,autoAssignCustomDomains:false,gitSource:{sha:env.GITHUB_SHA},meta:{githubCommitRef:previewBranch},url:'world-pulse-test.vercel.app',...patch};
    if(path.includes('protection-bypass'))return body.revoke?{}:{protectionBypass:{private:{scope:'shareable-link'}}};return {};
  };
  return {calls,run:(extra={},at=now)=>deployPreview({api,env:{...env,...extra},pause:async()=>{},now:at,smoke:async()=>{if(fail)throw new Error('smoke_failed');}})};
}
test('preview refuses wrong branch/repo/owner, absent gate/token, invalid SHA and expired staging before provider calls',async()=>{
  for(const patch of [{GITHUB_REF:'refs/heads/main'},{GITHUB_REPOSITORY_ID:'other'},{DATABASE_MIGRATION_URL:'forbidden'},{WP_PREVIEW_SYNC_ENABLED:'false'},{VERCEL_TOKEN:''},{GITHUB_SHA:'main'}]){
    const f=fixture();await assert.rejects(f.run(patch));assert.equal(f.calls.length,0);
  }
});
test('preview pins branch+SHA, omits production target, disables custom domains and revokes before success',async()=>{
  const f=fixture(),result=await f.run();const create=f.calls.find(row=>row.path==='/v13/deployments').body;
  assert.equal(create.target,undefined);assert.equal(create.autoAssignCustomDomains,false);assert.equal(create.gitSource.sha,env.GITHUB_SHA);assert.equal(create.gitSource.ref,previewBranch);
  assert.equal(result.sha,env.GITHUB_SHA);assert.ok(f.calls.at(-1).body.revoke);assert.ok(!f.calls.some(row=>/promote|domains/.test(row.path)));
});
test('receipt rejects production, another project/commit/branch and foreign host',async()=>{
  for(const patch of [{target:'production'},{projectId:'foreign'},{gitSource:{sha:'b'.repeat(40)}},{meta:{githubCommitRef:'main'}},{url:'foreign.example.com'},{autoAssignCustomDomains:true}]){
    const f=fixture(patch);await assert.rejects(f.run(),/preview_receipt_rejected/);assert.ok(!f.calls.some(row=>row.path.includes('protection-bypass')));
  }
});
test('temporary access is revoked even when API smoke fails',async()=>{
  const f=fixture({},true);await assert.rejects(f.run(),/smoke_failed/);assert.ok(f.calls.at(-1).body.revoke);
});

test('transient GET status failure retries without repeating deployment creation',async()=>{
  const f=fixture({},false,1);await f.run();
  assert.equal(f.calls.filter(row=>row.path==='/v13/deployments').length,1);
  assert.equal(f.calls.filter(row=>row.path==='/v13/deployments/dpl_fake').length,2);
});
test('expired temporary staging is rejected before any provider operation',async()=>{
  const f=fixture();await assert.rejects(f.run({},Date.parse('2026-10-31T01:15:25Z')),/staging_expired/);assert.equal(f.calls.length,0);
});
