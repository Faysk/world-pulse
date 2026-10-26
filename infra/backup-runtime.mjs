import {spawnSync} from 'node:child_process';
import {S3Client} from '@aws-sdk/client-s3';
import {backupBucket} from './backup-core.mjs';
export function command(args,{input,env={},maxBuffer=1024*1024}={}){
  const result=spawnSync('docker',args,{input,env:{PATH:process.env.PATH,HOME:process.env.HOME,...env},maxBuffer,timeout:240000});
  // pg errors can include COPY rows, identifiers or credentials. Never forward stderr.
  if(result.status!==0||result.error)throw Object.assign(new Error('backup_subprocess_failed'),{safeCode:commandFailureCode(result.stderr)});
  return result.stdout;
}
export function storage(env){
  return new S3Client({region:'auto',endpoint:`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials:{accessKeyId:env.R2_BACKUP_ACCESS_KEY_ID,secretAccessKey:env.R2_BACKUP_SECRET_ACCESS_KEY},
    maxAttempts:2,requestHandler:{connectionTimeout:15000,requestTimeout:60000}});
}
export const object=Key=>({Bucket:backupBucket,Key});
// Official multi-platform image digest exercised in Actions 40353610499.
export const postgresImage='postgres:18@sha256:edb0c08dc33befd0262ab3b5cf1c4f3f8cfd8b09e88c05b45adee29d6761ddb6';
// The minimal image purges build-time ca-certificates. Use the runner's trusted
// public CA bundle read-only; keep libpq verify-full, never sslmode=require.
export const postgresCaMount='type=bind,source=/etc/ssl/certs/ca-certificates.crt,target=/etc/ssl/certs/ca-certificates.crt,readonly';
export function commandFailureCode(stderr){
  const text=String(stderr??'');
  for(const [code,pattern] of [['tls',/root certificate|certificate verify|SSL error/i],
    ['authentication',/password authentication|no password supplied/i],['permission',/permission denied|must be owner/i],
    ['version',/server version mismatch/i],['snapshot',/invalid snapshot|snapshot.*does not exist/i],
    ['timeout',/statement timeout|lock timeout/i],['connection',/could not connect|connection .*failed|connection .*closed/i]])if(pattern.test(text))return code;
  return 'unclassified';
}
export async function waitForPostgres(container,run=command,pause=ms=>new Promise(r=>setTimeout(r,ms))){
  // The image's temporary initialization server accepts Unix sockets but no TCP.
  // Probe loopback INSIDE the network-isolated container to wait for the final server.
  for(let n=0;n<40;n++){
    try{run(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres']);return;}
    catch{await pause(500);}
  }
  throw new Error('backup_database_not_ready');
}
