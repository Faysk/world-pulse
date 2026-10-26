import {randomBytes} from 'node:crypto';
import {durableTables,transientTables,fingerprintSql} from './backup-core.mjs';
import {command,postgresImage} from './backup-runtime.mjs';
export async function restoreArchive(archive,manifest){
  const container='world-pulse-backup-restore';let started=false;
  const password=randomBytes(32).toString('hex'),local={POSTGRES_PASSWORD:password,PGPASSWORD:password,PGOPTIONS:'-c timezone=UTC'};
  try{
    command(['run','--detach','--name',container,'--network','none','--log-driver','none','--tmpfs','/var/lib/postgresql:rw,noexec,nosuid,size=1536m','-e','POSTGRES_PASSWORD',postgresImage],{env:local});started=true;
    let ready=false;
    for(let n=0;n<40;n++){
      try{command(['exec',container,'pg_isready','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}
    }
    if(!ready)throw new Error('restore_database_unavailable');
    command(['exec','-i','-e','PGPASSWORD',container,'pg_restore','-U','postgres','-d','postgres','--no-owner','--no-acl','--exit-on-error'],{input:archive,env:local});
    const sql=query=>command(['exec','-e','PGPASSWORD','-e','PGOPTIONS',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-c',query],{env:local}).toString().trim();
    for(const table of durableTables)if(sql(fingerprintSql(table))!==manifest.tables[table])throw new Error('restore_fingerprint_mismatch');
    for(const table of transientTables)if(sql(`SELECT count(*) FROM world_pulse.${table}`)!=='0')throw new Error('restore_transient_data_rejected');
    if(sql("SELECT count(*) FROM pg_constraint WHERE connamespace='world_pulse'::regnamespace AND NOT convalidated")!=='0')throw new Error('restore_constraint_invalid');
  }finally{if(started)command(['rm','--force',container]);}
}
