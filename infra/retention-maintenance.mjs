import {appendFile} from 'node:fs/promises';
import pg from 'pg';
import {maintenancePolicy} from './retention-policy.mjs';
import {consolidateInactive,inspectInactive} from '../server/retention.mjs';
let pool;
try{
  const policy=maintenancePolicy(process.env);
  pool=new pg.Pool({connectionString:policy.connectionString,max:1,connectionTimeoutMillis:5000,query_timeout:6000,allowExitOnIdle:true});
  const role=await pool.query(`SELECT rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolbypassrls,
    (SELECT count(*)::int FROM pg_auth_members WHERE member=pg_roles.oid) AS memberships
    FROM pg_roles WHERE rolname=current_user`);
  if(!role.rows.length||Object.entries(role.rows[0]).some(([key,value])=>key==='memberships'?value!==0:value!==false))throw new Error('runtime_role_too_powerful');
  const before=await inspectInactive(pool);
  let consolidatedVisitors=0,batches=0;
  const deadline=performance.now()+policy.maxDurationMs;
  if(policy.mode==='maintain')while(batches<policy.maxBatches&&performance.now()<deadline){
    const result=await consolidateInactive(pool,{limit:policy.batchSize});
    consolidatedVisitors+=result.consolidatedVisitors;batches++;
    if(result.consolidatedVisitors<policy.batchSize)break;
  }
  const after=policy.mode==='plan'?before:await inspectInactive(pool);
  const summary={operation:policy.mode,observedAt:new Date().toISOString(),before,consolidatedVisitors,batches,after};
  console.log(JSON.stringify(summary));
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`Retention operation\n\n\`\`\`json\n${JSON.stringify(summary,null,2)}\n\`\`\`\n`);
  // Nonzero backlog or locked eligible rows need review/retry, not a false success.
  if(policy.mode==='maintain'&&after.eligibleAtLeast>0)throw new Error('retention_backlog_remaining');
}catch(error){
  const safe=['retention_target_rejected','retention_operation_required','retention_disabled','retention_owner_forbidden',
    'retention_host_not_attested','retention_database_rejected','runtime_role_too_powerful','retention_backlog_remaining'];
  console.error(safe.includes(error.message)?error.message:'Retention operation failed; private database details suppressed.');process.exitCode=1;
}finally{if(pool)await pool.end();}
