import { required, runtimeConfig, runtimeSecrets, validateRuntime,productionReleaseFlags } from './config.mjs';

try {
  validateRuntime();
  required(['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID']);
  const { VERCEL_ORG_ID, VERCEL_PROJECT_ID, VERCEL_TOKEN } = process.env;
  const flags=productionReleaseFlags();
  const endpoint = new URL(`https://api.vercel.com/v10/projects/${encodeURIComponent(VERCEL_PROJECT_ID)}/env`);
  endpoint.searchParams.set('teamId', VERCEL_ORG_ID);
  endpoint.searchParams.set('upsert', 'true');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([...runtimeSecrets, ...runtimeConfig,...Object.keys(flags)].map(key => ({
      key, value: flags[key]??process.env[key], target: ['production'],
      type: runtimeSecrets.includes(key) ? 'sensitive' : 'plain',
      comment: 'Managed from GitHub Actions production environment',
    }))),
    signal: AbortSignal.timeout(30_000),
  });
  // Provider responses may contain credentials; never print response bodies.
  if (!response.ok) throw new Error(`Vercel sync failed (HTTP ${response.status})`);
  const result = await response.json();
  if (result.failed?.length) throw new Error('Vercel rejected one or more environment variables');
  console.log('Production runtime configuration synchronized. Redeploy to apply.');
} catch (error) {
  console.error(error.message.startsWith('Missing configuration:') || error.message.startsWith('Vercel ')
    ? error.message : 'Configuration sync failed; check configuration and provider status.');
  process.exitCode = 1;
}
