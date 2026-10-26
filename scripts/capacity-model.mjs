export const tabCounts=Object.freeze([1,10,25,50,100]);
export const pathsFor=profile=>{
  if(profile==='map')return ['/api/regions'];
  if(profile==='map-ranking')return ['/api/regions','/api/ranking'];
  throw new Error('capacity_profile_rejected');
};
export function capacityConfiguration(env){
  if(env.WP_CAPACITY_BENCHMARK!=='1'||['DATABASE_URL','DATABASE_MIGRATION_URL','VERCEL_TOKEN','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BACKUP_ACCESS_KEY_ID','R2_BACKUP_SECRET_ACCESS_KEY','WP_BACKUP_ENCRYPTION_KEY'].some(key=>env[key]))throw new Error('capacity_environment_rejected');
  const profile=env.WP_CAPACITY_PROFILE??'map',mode=env.WP_CAPACITY_MODE??'burst';
  pathsFor(profile);if(!['burst','cadence'].includes(mode))throw new Error('capacity_mode_rejected');
  return {profile,mode};
}
export function summarizeRequests(samples){
  const latencies=rows=>{
    const sorted=rows.map(s=>s.ms).sort((a,b)=>a-b);
    const percentile=p=>sorted.length?Number(sorted[Math.max(0,Math.ceil(sorted.length*p)-1)].toFixed(2)):null;
    return {p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),max:sorted.length?Number(sorted.at(-1).toFixed(2)):null};
  };
  const statuses={},errors={};let bytes=0;
  for(const s of samples){statuses[s.status]=(statuses[s.status]??0)+1;bytes+=s.bytes;if(s.error)errors[s.error]=(errors[s.error]??0)+1;}
  return {requests:samples.length,statuses,errors,decodedJsonBytes:bytes,latencyMs:latencies(samples),
    latencyByStatus:Object.fromEntries(Object.keys(statuses).map(status=>[status,latencies(samples.filter(s=>String(s.status)===status))]))};
}
