export const runtimeSecrets = ['DATABASE_URL', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
export const runtimeConfig = ['R2_ACCOUNT_ID', 'R2_BUCKET_NAME', 'APP_URL'];

export function productionReleaseFlags(env=process.env){
  const keys=['WP_ALPHA_RELEASE','WP_API_ENABLED','WP_GEO_PUBLIC_ENABLED','WP_GEO_COUNTRY_ENABLED','WP_GEO_DIRECT_EDGE'];
  const flags=Object.fromEntries(keys.map(key=>[key,env[key]||'false']));
  if(Object.values(flags).some(value=>!['true','false'].includes(value)))throw new Error('Invalid release flag');
  if(flags.WP_ALPHA_RELEASE==='true'&&flags.WP_API_ENABLED!=='true')throw new Error('Alpha requires API');
  if(flags.WP_GEO_PUBLIC_ENABLED==='true'&&flags.WP_API_ENABLED!=='true')throw new Error('Geography requires API');
  if(flags.WP_GEO_COUNTRY_ENABLED==='true'&&(flags.WP_GEO_PUBLIC_ENABLED!=='true'||flags.WP_GEO_DIRECT_EDGE!=='true'))throw new Error('Country requires attested geography');
  return flags;
}

export function required(keys, env = process.env) {
  const missing = keys.filter(key => !env[key]?.trim());
  if (missing.length) throw new Error(`Missing configuration: ${missing.join(', ')}`);
}

export function validateRuntime(env = process.env) {
  required([...runtimeSecrets, ...runtimeConfig], env);
  const database = new URL(env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(database.protocol)) throw new Error('DATABASE_URL must be PostgreSQL');
  if (!['verify-full', 'verify-ca'].includes(database.searchParams.get('sslmode'))) {
    throw new Error('DATABASE_URL must use sslmode=verify-full or verify-ca');
  }
  if (!/^[a-f0-9]{32}$/.test(env.R2_ACCOUNT_ID)) throw new Error('Invalid R2_ACCOUNT_ID');
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(env.R2_BUCKET_NAME)) throw new Error('Invalid R2_BUCKET_NAME');
  if (env.APP_URL !== 'https://map.faysk.dev') throw new Error('Unexpected production APP_URL');
}
