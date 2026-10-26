import {ApiError} from './protocol.mjs';
const caches=Object.freeze({regions:{table:'region_snapshot_cache',lock:1867403},countries:{table:'country_snapshot_cache',lock:1867401}});
// Caller owns a transaction with SET LOCAL lock_timeout/statement_timeout.
// These are the SAME advisory locks used by location withdrawal/invalidation.
export async function readSnapshotCache(client,kind,build){
  const config=caches[kind];if(!config)throw new RangeError('Unknown snapshot cache');
  const window=async()=>{
    const {rows:[clock]}=await client.query('SELECT floor(extract(epoch FROM statement_timestamp())/5)*5000 AS ms');
    return Number(clock.ms);
  };
  const cached=async asOfMs=>{
    const result=await client.query(`SELECT payload FROM world_pulse.${config.table} WHERE key=true AND window_start=to_timestamp($1/1000.0)`,[asOfMs]);
    return result.rows[0]?.payload;
  };
  let asOfMs=await window(),payload=await cached(asOfMs);
  if(payload)return payload;
  try{await client.query('SELECT pg_advisory_xact_lock($1::bigint)',[config.lock]);}
  catch(error){
    if(error.code==='55P03')throw new ApiError(503,'geography_refreshing','Mapa atualizando.');
    throw error;
  }
  // Another transaction may have rebuilt OR withdrawn data while we waited.
  // Re-read both the clock and cache; never reuse the pre-lock result.
  asOfMs=await window();payload=await cached(asOfMs);
  return payload??await build(asOfMs);
}
