import {validateStagingUrl} from './staging-db.mjs';
export const previewBranch='codex/remote-staging';
export const previewProject='prj_m2bOqJyrOCGfnKTHd5GsZydNy2ET';
export const previewTeam='team_9wuTfarCQ3L63xtufPKUDzi0';

export function previewConfiguration(env,now=Date.now()){
  if(env.GITHUB_REF!==`refs/heads/${previewBranch}`||env.GITHUB_REPOSITORY!=='Faysk/world-pulse')throw new Error('preview_target_rejected');
  if(env.DATABASE_MIGRATION_URL)throw new Error('preview_owner_forbidden');
  const database=validateStagingUrl(env.DATABASE_URL,false,now);
  const values={DATABASE_URL:database,WP_API_ENABLED:'true',WP_PREVIEW_UI:'true',WP_GEO_PUBLIC_ENABLED:'true',
    WP_GEO_COUNTRY_ENABLED:'false',WP_GEO_DIRECT_EDGE:'false'};
  return Object.entries(values).map(([key,value])=>({key,value,type:key==='DATABASE_URL'?'sensitive':'plain',target:['preview'],
    gitBranch:previewBranch,comment:'Managed from GitHub Environment staging; no production target'}));
}

export async function syncPreviewConfiguration(api,env,now=Date.now()){
  const config=previewConfiguration(env,now);
  if(env.WP_PREVIEW_SYNC_ENABLED!=='true')throw new Error('preview_sync_disabled');
  const result=await api(`/v10/projects/${previewProject}/env?upsert=true`,{method:'POST',body:JSON.stringify(config)});
  if(result.failed?.length)throw new Error('preview_sync_failed');
  return {keys:config.map(item=>item.key),branch:previewBranch,target:'preview'};
}
