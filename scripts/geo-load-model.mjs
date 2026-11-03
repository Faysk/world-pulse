/** Offline geographic DEMAND model: no network requests or real users. */
import { pathToFileURL } from 'node:url';

export const REGIONS = Object.freeze([
  {id:'br-sao-paulo',label:'São Paulo',weight:24,utcOffsetMinutes:-180},
  {id:'us-east',label:'US East',weight:18,utcOffsetMinutes:-300},
  {id:'us-west',label:'US West',weight:12,utcOffsetMinutes:-480},
  {id:'pt-lisbon',label:'Portugal',weight:8,utcOffsetMinutes:0},
  {id:'eu-central',label:'Central Europe',weight:16,utcOffsetMinutes:60},
  {id:'in-mumbai',label:'India',weight:8,utcOffsetMinutes:330},
  {id:'jp-tokyo',label:'Japan',weight:8,utcOffsetMinutes:540},
  {id:'au-sydney',label:'Australia',weight:6,utcOffsetMinutes:660},
]);
export const PROFILE_POPULATIONS=Object.freeze([1000n,10000n,100000n,1000000000n]);

export function distributeExact(total,regions=REGIONS) {
  if(typeof total!=='bigint'||total<0n) throw new Error('invalid_population');
  if(!regions.length||regions.some(r=>!Number.isSafeInteger(r.weight)||r.weight<=0)) throw new Error('invalid_regions');
  const sum=regions.reduce((a,r)=>a+BigInt(r.weight),0n);
  const rows=regions.map(r=>({...r,users:total*BigInt(r.weight)/sum}));
  const used=rows.reduce((a,r)=>a+r.users,0n);
  const ranking=regions.map((r,i)=>({i,remainder:total*BigInt(r.weight)%sum}))
    .sort((a,b)=>a.remainder===b.remainder?a.i-b.i:a.remainder>b.remainder?-1:1);
  for(let i=0;i<Number(total-used);i++) rows[ranking[i].i].users++;
  return rows;
}
const ceil=(a,b)=>(a+b-1n)/b;
const utcHour=mins=>((Math.round(mins/60)%24)+24)%24;

export function modelGeoDemand({
  population,activeBasisPoints=1000,requestsPerActive=2,
  durationSeconds=3600,release='simultaneous'
}={}) {
  if(typeof population!=='bigint'||population<0n) throw new Error('invalid_population');
  if(!Number.isInteger(activeBasisPoints)||activeBasisPoints<0||activeBasisPoints>10000) throw new Error('invalid_activity');
  if(!Number.isSafeInteger(requestsPerActive)||requestsPerActive<0||requestsPerActive>100) throw new Error('invalid_request_factor');
  if(!Number.isSafeInteger(durationSeconds)||durationSeconds<60||durationSeconds>86400) throw new Error('invalid_duration');
  if(!['simultaneous','rolling'].includes(release)) throw new Error('invalid_release');

  const activeByRegion=distributeExact(population*BigInt(activeBasisPoints)/10000n);
  const perRegion=distributeExact(population).map((r,i)=>{
    const activeUsers=activeByRegion[i].users;
    const requests=activeUsers*BigInt(requestsPerActive);
    // Fixed UTC offsets deliberately ignore seasonal DST; scenario only.
    const releaseUtcHour=release==='simultaneous'?0:utcHour(-r.utcOffsetMinutes);
    return {...r,activeUsers,requests,releaseUtcHour,modeledPeakRps:ceil(requests,BigInt(durationSeconds))};
  });
  const totalRequests=perRegion.reduce((a,r)=>a+r.requests,0n);
  const hourly=Array.from({length:24},(_,hour)=>({hour,requests:0n}));
  for(const r of perRegion) hourly[r.releaseUtcHour].requests+=r.requests;
  return {
    population,activeBasisPoints,requestsPerActive,durationSeconds,release,
    totalRequests,singleWindowDemandRps:ceil(totalRequests,BigInt(durationSeconds)),
    peakModeledRps:hourly.reduce((max,b)=>{const n=ceil(b.requests,BigInt(durationSeconds));return n>max?n:max;},0n),
    perRegion,hourly,
    caveats:[
      'Offline demand model only; generates zero HTTP requests.',
      'Geographic weights are synthetic and do not represent real people, connections or source locations.',
      'UTC offsets are approximate and ignore seasonal daylight saving time.',
      'Modeled demand is not measured throughput, latency, capacity, cost or success rate.'
    ]
  };
}

export const reportJSON=model=>JSON.stringify(model,(_key,value)=>typeof value==='bigint'?value.toString():value,2);

const intFlag=(value,name,max)=>{
  if(!/^\d+$/.test(value)||BigInt(value)>BigInt(max)) throw new Error('invalid_'+name);
  return Number(value);
};
export function parseArgs(argv) {
  const flags=new Map();
  for(const token of argv) {
    const m=/^--([a-z-]+)=(.+)$/.exec(token);
    if(!m||flags.has(m[1])) throw new Error('invalid_argument');
    flags.set(m[1],m[2]);
  }
  for(const key of flags.keys()) {
    if(!['population','active-bps','requests-per-active','duration-seconds','release'].includes(key)) throw new Error('unknown_argument');
  }
  const populationRaw=flags.get('population')||'1000000000';
  if(!/^\d+$/.test(populationRaw)||BigInt(populationRaw)>1000000000000n) throw new Error('invalid_population');
  return {
    population:BigInt(populationRaw),
    activeBasisPoints:intFlag(flags.get('active-bps')||'1000','active_bps',10000),
    requestsPerActive:intFlag(flags.get('requests-per-active')||'2','requests_per_active',100),
    durationSeconds:intFlag(flags.get('duration-seconds')||'3600','duration_seconds',86400),
    release:flags.get('release')||'simultaneous'
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {console.log(reportJSON(modelGeoDemand(parseArgs(process.argv.slice(2)))));}
  catch(e) {console.error(e.message);process.exitCode=1;}
}
