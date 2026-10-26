import {appendFile} from 'node:fs/promises';
import {previewConfiguration,previewBranch,previewTeam,syncPreviewConfiguration} from './preview-config.mjs';
import {vercelApi} from './vercel-api.mjs';
try{
  const operation=process.env.WP_PREVIEW_OPERATION;
  if(!['plan','sync'].includes(operation))throw new Error('preview_operation_required');
  const config=previewConfiguration(process.env);
  if(operation==='sync'){
    if(!process.env.VERCEL_TOKEN)throw new Error('preview_token_missing');
    await syncPreviewConfiguration(vercelApi({token:process.env.VERCEL_TOKEN,team:previewTeam}),process.env);
  }
  const message=`Preview ${operation}: ${previewBranch}. Keys: ${config.map(item=>item.key).join(', ')}. No deployment or production mutation.\n`;
  console.log(message);
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,message);
}catch(error){
  const safe=['preview_operation_required','preview_token_missing','preview_target_rejected','preview_owner_forbidden',
    'preview_sync_disabled','preview_sync_failed','preview_credential_expired','preview_credential_renewal_required','staging_expired','staging_target_rejected'];
  console.error(safe.includes(error.message)?error.message:'Preview configuration failed; private provider details suppressed.');
  process.exitCode=1;
}
