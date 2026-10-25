import {previewConfiguration,previewBranch,previewProject,syncPreviewConfiguration} from './preview-config.mjs';
export async function deployPreview({api,env,pause,smoke,now=Date.now(),receipt=()=>{},progress=()=>{}}){
  previewConfiguration(env,now);
  if(env.WP_PREVIEW_SYNC_ENABLED!=='true'||!env.VERCEL_TOKEN||!/^[0-9a-f]{40}$/.test(env.GITHUB_SHA??'')||env.GITHUB_REPOSITORY_ID!=='1431565257')throw new Error('preview_deploy_rejected');
  await syncPreviewConfiguration(api,env,now);
  const candidate=await api('/v13/deployments',{method:'POST',body:JSON.stringify({name:'world-pulse',project:previewProject,autoAssignCustomDomains:false,
    gitSource:{type:'github',repoId:env.GITHUB_REPOSITORY_ID,ref:previewBranch,sha:env.GITHUB_SHA},
    gitMetadata:{commitRef:previewBranch,commitSha:env.GITHUB_SHA,ci:true,ciType:'github-actions'}})});
  if(!/^dpl_[A-Za-z0-9]+$/.test(candidate.id??''))throw new Error('preview_deployment_missing');
  receipt(candidate.id);
  let ready,readFailures=0;
  for(let i=0;i<60;i++){
    let status;
    try{status=await api(`/v13/deployments/${candidate.id}`);readFailures=0;}
    catch(error){
      if(++readFailures>3||!(error.name==='TimeoutError'||error.name==='AbortError'||error.name==='TypeError'||error.providerStatus===429||error.providerStatus>=500))throw error;
      progress('Temporary deployment status read failure; retrying GET only.');await pause(5000);continue;
    }
    if(['ERROR','CANCELED','BLOCKED'].includes(status.readyState))throw new Error('preview_build_failed');
    if(status.readyState==='READY'){ready=status;break;}await pause(5000);
  }
  progress('Deployment status read completed.');
  if(!ready)throw new Error('preview_build_timeout');
  if(ready.target!=null||ready.projectId!==previewProject||ready.autoAssignCustomDomains!==false||
    ready.gitSource?.sha!==env.GITHUB_SHA||ready.meta?.githubCommitRef!==previewBranch||
    !/^world-pulse-[a-z0-9-]+\.vercel\.app$/.test(ready.url??''))throw new Error('preview_receipt_rejected');
  progress('Preview target, source and isolation receipt verified.');
  const origin='https://'+ready.url;
  let secret;
  try{
    const access=await api(`/aliases/${candidate.id}/protection-bypass`,{method:'PATCH',body:JSON.stringify({ttl:600})});
    secret=Object.entries(access.protectionBypass??{}).find(([,value])=>value.scope==='shareable-link')?.[0];
    if(!secret)throw new Error('preview_access_missing');
    progress('Temporary preview access granted; testing HTTPS.');
    await smoke(origin,secret);
  }finally{
    if(secret)await api(`/aliases/${candidate.id}/protection-bypass`,{method:'PATCH',body:JSON.stringify({revoke:{secret,regenerate:false}})});
  }
  return {id:candidate.id,origin,sha:env.GITHUB_SHA};
}
