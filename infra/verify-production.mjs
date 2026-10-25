import {appendFile} from 'node:fs/promises';
import {setTimeout} from 'node:timers/promises';
import {productionReleaseFlags,required} from './config.mjs';
import {smokeStaticSite,smokePublishedSite,SmokeCheckError} from './staged-release.mjs';
import {vercelApi} from './vercel-api.mjs';
try{
  required(['VERCEL_TOKEN','VERCEL_ORG_ID','VERCEL_PROJECT_ID']);
  if(process.env.GITHUB_REF!=='refs/heads/main'||process.env.GITHUB_REPOSITORY!=='Faysk/world-pulse'||
    process.env.VERCEL_ORG_ID!=='team_9wuTfarCQ3L63xtufPKUDzi0'||process.env.VERCEL_PROJECT_ID!=='prj_m2bOqJyrOCGfnKTHd5GsZydNy2ET'||process.env.APP_URL!=='https://map.faysk.dev')throw new Error('production_verify_target_rejected');
  const flags=productionReleaseFlags(),api=vercelApi({token:process.env.VERCEL_TOKEN,team:process.env.VERCEL_ORG_ID});
  const project=await api('/v9/projects/'+process.env.VERCEL_PROJECT_ID),id=project.targets?.production?.id;
  if(!/^dpl_[A-Za-z0-9]+$/.test(id??''))throw new Error('production_target_missing');
  const deployment=await api('/v13/deployments/'+id);
  if(deployment.readyState!=='READY'||deployment.projectId!==process.env.VERCEL_PROJECT_ID)throw new Error('production_target_not_ready');
  const sha=deployment.gitSource?.sha??deployment.meta?.githubCommitSha;
  if(!/^[0-9a-f]{40}$/.test(sha??''))throw new Error('production_commit_missing');
  await smokePublishedSite(origin=>smokeStaticSite(origin,null,fetch,{activeApi:flags.WP_API_ENABLED==='true'}),setTimeout);
  console.log(`Production deployment ${id}, source ${sha}: public HTTPS HTML/JS/CSS and configured API health passed. No deploy, promotion or environment mutation.`);
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`Verified live deployment: ${id}\nSource commit: ${sha}\nPublic HTTPS/assets and configured API passed. Read-only provider/site verification.\n`);
}catch(error){
  console.error('Production verification failed; credentials and provider bodies suppressed. No deployment or promotion requested.');
  if(error instanceof SmokeCheckError)console.error(`Safe smoke failure: ${error.message}`);
  if(['production_verify_target_rejected','production_target_missing','production_target_not_ready','production_commit_missing'].includes(error?.message))console.error(error.message);
  process.exitCode=1;
}
