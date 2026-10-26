import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {sealBackup,openBackup,durableTables,backupDatabase,backupContext,expiredBackupKeys,fingerprintSql,backupBucket} from './backup-core.mjs';
const key=randomBytes(32).toString('base64');
const manifest={version:1,serverMajor:18,tables:Object.fromEntries(durableTables.map(t=>[t,'0:'+'a'.repeat(32)]))};
test('encrypted archive roundtrip authenticates every byte and rejects another key or malformed manifest',()=>{
  const raw=Buffer.from('PGDMP disposable fixture'),encrypted=sealBackup(raw,manifest,key);
  assert.ok(!encrypted.includes(raw));assert.deepEqual(openBackup(encrypted,key),{archive:raw,manifest});
  for(const at of [0,6,20,encrypted.length-1]){const bad=Buffer.from(encrypted);bad[at]^=1;assert.throws(()=>openBackup(bad,key));}
  assert.throws(()=>openBackup(encrypted,randomBytes(32).toString('base64')));
  assert.throws(()=>sealBackup(raw,manifest,'bad'));
  assert.throws(()=>openBackup(sealBackup(raw,{...manifest,tables:{}},key),key));
});
test('backup targets exact production runtime directly, never staging or migration owner',()=>{
  const url='postgresql://world_pulse_app:disposable@ep-morning-night-zawemzb3-pooler.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full';
  assert.equal(backupDatabase(url).PGHOST,'ep-morning-night-zawemzb3.c-2.eu-west-2.aws.neon.tech');
  for(const bad of [url.replace('world_pulse_app','neondb_owner'),url.replace('ep-morning-night-zawemzb3','ep-misty-glade-za9nxlhg'),url+'&sslmode=require'])assert.throws(()=>backupDatabase(bad));
  assert.throws(()=>fingerprintSql('visitors; DROP SCHEMA world_pulse'));
});
test('backup gate rejects PR refs, other repositories, owner exposure and unpinned storage',()=>{
  const env={GITHUB_REPOSITORY:'Faysk/world-pulse',GITHUB_REF:'refs/heads/main',WP_BACKUP_ENABLED:'true',R2_BACKUP_BUCKET_NAME:backupBucket,R2_ACCOUNT_ID:'ef7f15c85d885f090262700e297ec167',R2_BACKUP_ACCESS_KEY_ID:'fake',R2_BACKUP_SECRET_ACCESS_KEY:'fake',WP_BACKUP_ENCRYPTION_KEY:key};
  backupContext(env);
  for(const patch of [{GITHUB_REF:'refs/pull/1/merge'},{GITHUB_REPOSITORY:'other/repo'},{WP_BACKUP_ENABLED:'false'},{DATABASE_MIGRATION_URL:'forbidden'},{R2_BACKUP_BUCKET_NAME:'world-pulse-production'},{WP_BACKUP_ENCRYPTION_KEY:'bad'}])assert.throws(()=>backupContext({...env,...patch}));
});
test('retention selects only old objects in our bounded daily namespace',()=>{
  const key='daily/2026-10-20T01-00-00Z-11111111-1111-4111-8111-111111111111.wpbk';
  const old=new Date('2026-10-20'),now=Date.parse('2026-10-28');
  assert.deepEqual(expiredBackupKeys([{Key:key,LastModified:old},{Key:key+'.verified.json',LastModified:old},{Key:'unrelated',LastModified:old},{Key:key.replace('20T','28T'),LastModified:new Date(now)}],now),[key,key+'.verified.json']);
});
