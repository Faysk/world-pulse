import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {writeFile,mkdir,chmod} from 'node:fs/promises';
import {PutObjectCommand,ListObjectsV2Command} from '@aws-sdk/client-s3';
import {backupContext,backupDatabase,durableTables,transientTables,fingerprintSql,maxArchiveBytes,sealBackup} from './backup-core.mjs';
import {command,storage,object} from './backup-runtime.mjs';
let db,s3;
try{
  const env=process.env;backupContext(env);
  const libpq=backupDatabase(env.DATABASE_URL);
  db=new pg.Client({host:libpq.PGHOST,user:libpq.PGUSER,password:libpq.PGPASSWORD,database:libpq.PGDATABASE,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:15000,query_timeout:180000});
  await db.connect();await db.query("SET timezone='UTC'");await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await db.query("SET LOCAL statement_timeout='180s'");await db.query("SET LOCAL idle_in_transaction_session_timeout='5min'");
  const {rows:[row]}=await db.query("SELECT current_user AS role,current_setting('server_version_num')::int AS version,pg_export_snapshot() AS snapshot");
  const major=Math.floor(row.version/10000);
  if(row.role!=='world_pulse_app'||major<14||major>18||!(/^[0-9a-f]+-[0-9a-f]+-\d+$/i.test(row.snapshot)))throw new Error('backup_database_rejected');
  s3=storage(env);
  const recent=await s3.send(new ListObjectsV2Command({...object(''),Prefix:'daily/',MaxKeys:1000}));
  if(recent.IsTruncated||(recent.Contents??[]).reduce((sum,o)=>sum+(o.Size??0),0)+90*1024*1024>1024*1024*1024||
    (recent.Contents??[]).filter(o=>o.Key?.endsWith('.wpbk')&&o.LastModified>new Date(Date.now()-86400000)).length>=3)throw new Error('backup_storage_budget_reached');
  const {rows:inventory}=await db.query("SELECT tablename FROM pg_tables WHERE schemaname='world_pulse' ORDER BY tablename");
  if(inventory.map(r=>r.tablename).join()!==[...durableTables,...transientTables].sort().join())throw new Error('backup_schema_inventory_rejected');
  const tables={};
  for(const table of durableTables){const {rows:[r]}=await db.query(fingerprintSql(table));tables[table]=r.fingerprint;}
  const args=['run','--rm','--network','host'];
  for(const name of Object.keys(libpq))args.push('-e',name);
  args.push('postgres:18','pg_dump','--format=custom','--schema=world_pulse','--no-acl','--no-owner','--lock-wait-timeout=5s','--snapshot='+row.snapshot);
  for(const table of transientTables)args.push('--exclude-table-data=world_pulse.'+table);
  const archive=command(args,{env:libpq,maxBuffer:maxArchiveBytes});
  await db.query('COMMIT');
  const manifest={version:1,serverMajor:major,createdAt:new Date().toISOString(),tables};
  const encrypted=sealBackup(archive,manifest,env.WP_BACKUP_ENCRYPTION_KEY);
  const stamp=new Date().toISOString().slice(0,19).replaceAll(':','-')+'Z';
  const key=`daily/${stamp}-${randomUUID()}.wpbk`;
  await s3.send(new PutObjectCommand({...object(key),Body:encrypted,ContentType:'application/octet-stream'}));
  // Only the non-secret object name survives to the verification step; no raw dump on disk.
  const dir=env.RUNNER_TEMP+'/world-pulse-backup';await mkdir(dir,{recursive:true,mode:0o700});await chmod(dir,0o700);
  await writeFile(dir+'/object-key',key,{mode:0o600});
  console.log(`Encrypted logical backup uploaded (${encrypted.length} bytes); restoration still pending.`);
}catch{console.error('Backup export failed; provider/driver details suppressed.');process.exitCode=1;}
finally{await db?.end().catch(()=>{});s3?.destroy();}
