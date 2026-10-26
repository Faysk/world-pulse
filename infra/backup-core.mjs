import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {productionDatabaseUrl} from './production-target.mjs';
export const backupBucket='world-pulse-backups';
export const backupHost='ep-morning-night-zawemzb3-pooler.c-2.eu-west-2.aws.neon.tech';
export const maxArchiveBytes=64*1024*1024;
export const maxEncryptedBytes=90*1024*1024;
export const durableTables=['tags','visitors','visitor_tags','tap_batches','tag_history_totals'];
export const transientTables=['operation_budgets','country_snapshot_cache','region_snapshot_cache'];
const magic=Buffer.from('WPBK1');
export const digest=value=>createHash('sha256').update(value).digest('hex');
function key(value){
  if(!/^[A-Za-z0-9+/]{43}=$/.test(value??''))throw new Error('backup_key_invalid');
  const result=Buffer.from(value,'base64');
  if(result.length!==32||result.toString('base64')!==value)throw new Error('backup_key_invalid');
  return result;
}
export function sealBackup(archive,manifest,secret){
  if(!Buffer.isBuffer(archive)||!archive.length||archive.length>maxArchiveBytes)throw new Error('backup_size_rejected');
  const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(secret),nonce);
  cipher.setAAD(magic);
  const plain=Buffer.from(JSON.stringify({manifest,sha256:digest(archive),archive:archive.toString('base64')}));
  const payload=Buffer.concat([cipher.update(plain),cipher.final()]);
  return Buffer.concat([magic,nonce,cipher.getAuthTag(),payload]);
}
export function openBackup(encrypted,secret){
  if(encrypted.length<34||encrypted.length>maxEncryptedBytes||!encrypted.subarray(0,5).equals(magic))throw new Error('backup_envelope_rejected');
  const decipher=createDecipheriv('aes-256-gcm',key(secret),encrypted.subarray(5,17));
  decipher.setAAD(magic);decipher.setAuthTag(encrypted.subarray(17,33));
  const payload=JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(33)),decipher.final()]).toString());
  const archive=Buffer.from(payload.archive,'base64');
  if(!archive.length||archive.length>maxArchiveBytes||digest(archive)!==payload.sha256)throw new Error('backup_integrity_rejected');
  if(payload.manifest?.version!==1||!Number.isInteger(payload.manifest.serverMajor)||payload.manifest.serverMajor<14||payload.manifest.serverMajor>18)throw new Error('backup_manifest_rejected');
  if(Object.keys(payload.manifest.tables??{}).sort().join()!==[...durableTables].sort().join())throw new Error('backup_manifest_rejected');
  for(const table of durableTables)if(!/^\d+:[0-9a-f]{32}$/.test(payload.manifest.tables[table]))throw new Error('backup_manifest_rejected');
  return {archive,manifest:payload.manifest};
}
export function backupContext(env){
  if(env.GITHUB_REPOSITORY!=='Faysk/world-pulse'||env.GITHUB_REF!=='refs/heads/main'||env.WP_BACKUP_ENABLED!=='true'||env.DATABASE_MIGRATION_URL)throw new Error('backup_context_rejected');
  if(env.R2_BACKUP_BUCKET_NAME!==backupBucket||env.R2_ACCOUNT_ID!=='ef7f15c85d885f090262700e297ec167'||!env.R2_BACKUP_ACCESS_KEY_ID||!env.R2_BACKUP_SECRET_ACCESS_KEY)throw new Error('backup_storage_rejected');
  key(env.WP_BACKUP_ENCRYPTION_KEY);
}
export function backupDatabase(value){
  const url=new URL(productionDatabaseUrl(value,backupHost));
  url.hostname=url.hostname.replace('-pooler.','.');
  return {PGHOST:url.hostname,PGUSER:'world_pulse_app',PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:'neondb',PGSSLMODE:'verify-full',PGSSLROOTCERT:'/etc/ssl/certs/ca-certificates.crt',PGCONNECT_TIMEOUT:'15',PGOPTIONS:'-c statement_timeout=180000 -c lock_timeout=5000 -c timezone=UTC'};
}
export function fingerprintSql(table){
  if(!durableTables.includes(table))throw new Error('backup_table_rejected');
  // Order-independent consistency check, encrypted with the dump. Not an authentication primitive.
  return `SELECT count(*)::text || ':' || md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS fingerprint FROM world_pulse.${table} t`;
}
export function expiredBackupKeys(objects,now=Date.now()){
  return objects.filter(o=>/^daily\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-[0-9a-f-]{36}\.wpbk(?:\.verified\.json)?$/.test(o.Key??'')&&
    o.LastModified instanceof Date&&o.LastModified.getTime()<now-7*86400000).map(o=>o.Key);
}
