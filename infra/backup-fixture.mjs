// No cloud credentials. Real pg_dump -> encryption -> decryption -> isolated pg_restore.
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {command,postgresImage} from './backup-runtime.mjs';
import {restoreArchive} from './backup-restore.mjs';
import {durableTables,transientTables,fingerprintSql,sealBackup,openBackup,maxArchiveBytes} from './backup-core.mjs';
const container='world-pulse-backup-fixture';let started=false;
const local={POSTGRES_PASSWORD:randomBytes(32).toString('hex'),PGOPTIONS:'-c timezone=UTC'};
try{
  command(['run','--detach','--name',container,'--network','none','--log-driver','none','--tmpfs','/var/lib/postgresql:rw,noexec,nosuid,size=512m','-e','POSTGRES_PASSWORD',postgresImage],{env:local});started=true;
  let ready=false;
  for(let n=0;n<40;n++){try{command(['exec',container,'pg_isready','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}}
  if(!ready)throw new Error('fixture_not_ready');
  const sql=query=>command(['exec','-i','-e','PGOPTIONS',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:query,env:local}).toString().trim();
  sql('CREATE ROLE world_pulse_app LOGIN NOINHERIT;');
  for(const name of ['0001-runtime-access','0002-participation-core','0003-time-balances','0004-operation-budgets','0005-retention-rollups','0006-country-geography','0007-regional-points','0008-one-km-regions'])sql(await readFile(new URL('./sql/'+name+'.sql',import.meta.url),'utf8'));
  sql(`INSERT INTO world_pulse.tags(id,normalized,color) VALUES ('11111111-1111-4111-8111-111111111111','fixture','#abcdef');
    INSERT INTO world_pulse.visitors(id,session_hash,expires_at,country_consent,country_code,region_cell) VALUES
    ('22222222-2222-4222-8222-222222222222',repeat('a',64),now()+interval '30 days',true,'PT','r2:10000:1');
    INSERT INTO world_pulse.visitor_tags(visitor_id,tag_id,seconds,expires_at) VALUES ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',60,now()+interval '1 hour');
    INSERT INTO world_pulse.tap_batches(visitor_id,batch_id,tag_id,clicks,fingerprint) VALUES ('22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',1,repeat('b',64));
    INSERT INTO world_pulse.tag_history_totals(tag_id,participants,credited_seconds) VALUES ('11111111-1111-4111-8111-111111111111',9,12345678901234567890);
    INSERT INTO world_pulse.operation_budgets VALUES ('reads_minute',now(),42);
    INSERT INTO world_pulse.country_snapshot_cache VALUES (true,now(),'{}');
    INSERT INTO world_pulse.region_snapshot_cache VALUES (true,now(),'{}');`);
  const tables=Object.fromEntries(durableTables.map(t=>[t,sql(fingerprintSql(t))]));
  const args=['exec',container,'pg_dump','-U','world_pulse_app','-d','postgres','--format=custom','--schema=world_pulse','--no-acl','--no-owner'];
  for(const table of transientTables)args.push('--exclude-table-data=world_pulse.'+table);
  const archive=command(args,{maxBuffer:maxArchiveBytes});
  const key=randomBytes(32).toString('base64'),encrypted=sealBackup(archive,{version:1,serverMajor:18,tables},key);
  assert.ok(!encrypted.includes(Buffer.from('fixture')));
  const opened=openBackup(encrypted,key);await restoreArchive(opened.archive,opened.manifest);
  console.log('Synthetic non-empty SQL schema 0001–0008, idempotency batches, balances, geography and large history totals roundtrip verified. Transient caches/budgets excluded.');
}catch{console.error('Disposable backup fixture failed; raw SQL and data suppressed.');process.exitCode=1;}
finally{if(started)command(['rm','--force',container]);}
