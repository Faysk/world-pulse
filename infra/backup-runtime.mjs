import {spawnSync} from 'node:child_process';
import {S3Client} from '@aws-sdk/client-s3';
import {backupBucket} from './backup-core.mjs';
export function command(args,{input,env={},maxBuffer=1024*1024}={}){
  const result=spawnSync('docker',args,{input,env:{PATH:process.env.PATH,HOME:process.env.HOME,...env},maxBuffer,timeout:240000});
  // pg errors can include COPY rows, identifiers or credentials. Never forward stderr.
  if(result.status!==0||result.error)throw new Error('backup_subprocess_failed');
  return result.stdout;
}
export function storage(env){
  return new S3Client({region:'auto',endpoint:`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials:{accessKeyId:env.R2_BACKUP_ACCESS_KEY_ID,secretAccessKey:env.R2_BACKUP_SECRET_ACCESS_KEY},
    maxAttempts:2,requestHandler:{connectionTimeout:15000,requestTimeout:60000}});
}
export const object=Key=>({Bucket:backupBucket,Key});
