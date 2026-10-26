import {readFile} from 'node:fs/promises';
import {GetObjectCommand,PutObjectCommand,ListObjectsV2Command,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {backupContext,openBackup,durableTables,maxEncryptedBytes,digest,expiredBackupKeys} from './backup-core.mjs';
import {storage,object} from './backup-runtime.mjs';
import {restoreArchive} from './backup-restore.mjs';
let s3;
try{
  const env=process.env;backupContext(env);
  if(env.DATABASE_URL||env.DATABASE_MIGRATION_URL)throw new Error('restore_source_credentials_forbidden');
  const key=(await readFile(env.RUNNER_TEMP+'/world-pulse-backup/object-key','utf8')).trim();
  if(!/^daily\/[0-9TZ-]+-[0-9a-f-]{36}\.wpbk$/.test(key))throw new Error('backup_object_rejected');
  s3=storage(env);const response=await s3.send(new GetObjectCommand(object(key)));
  if(!response.ContentLength||response.ContentLength>maxEncryptedBytes)throw new Error('backup_size_rejected');
  const encrypted=Buffer.from(await response.Body.transformToByteArray());
  const {archive,manifest}=openBackup(encrypted,env.WP_BACKUP_ENCRYPTION_KEY);
  await restoreArchive(archive,manifest);
  const receipt={version:1,verifiedAt:new Date().toISOString(),sha256:digest(encrypted),tables:durableTables.length,encryptedBytes:encrypted.length};
  await s3.send(new PutObjectCommand({...object(key+'.verified.json'),Body:JSON.stringify(receipt),ContentType:'application/json'}));
  // Expiry is applied only after a fresh remote object has been restored and verified.
  const listed=await s3.send(new ListObjectsV2Command({...object(''),Prefix:'daily/',MaxKeys:1000}));
  if(listed.IsTruncated)throw new Error('backup_retention_listing_truncated');
  const expired=expiredBackupKeys(listed.Contents??[]);
  for(const old of expired)await s3.send(new DeleteObjectCommand(object(old)));
  console.log(`R2 readback, authenticated decryption and isolated PostgreSQL restore verified; ${durableTables.length} durable tables match. Expired objects removed: ${expired.length}.`);
}catch{console.error('Backup restore verification failed; data and driver details suppressed. Prior verified backups retained.');process.exitCode=1;}
finally{s3?.destroy();}
