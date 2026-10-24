import {stagingEndpoint} from './staging-db.mjs';
export function productionHost(host){
  if(!/^ep-[a-z0-9-]+-pooler\.c-2\.eu-west-2\.aws\.neon\.tech$/.test(host??'')||host.startsWith(stagingEndpoint+'-'))throw new Error('production_host_not_attested');
  return host;
}
export function productionDatabaseUrl(value,expectedHost,owner=false){
  productionHost(expectedHost);
  let url;try{url=new URL(value);}catch{throw new Error('production_database_rejected');}
  const host=owner?expectedHost.replace(/-pooler(?=\.c-2\.)/,''):expectedHost;
  if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!==host||url.port||url.pathname!=='/neondb'||
    url.username!==(owner?'neondb_owner':'world_pulse_app')||!url.password||url.searchParams.getAll('sslmode').length!==1||
    url.searchParams.get('sslmode')!=='verify-full')throw new Error('production_database_rejected');
  return url.toString();
}
export function runtimeHostMetadata(value){
  let host;try{host=new URL(value).hostname;}catch{throw new Error('production_database_rejected');}
  productionDatabaseUrl(value,host);return host;
}
