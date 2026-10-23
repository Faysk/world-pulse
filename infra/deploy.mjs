import { readFile, appendFile, access } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { required } from './config.mjs';

try {
  required(['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID', 'GITHUB_SHA', 'GITHUB_REPOSITORY_ID']);
  if (process.env.GITHUB_REF !== 'refs/heads/main') throw new Error();
  // Infrastructure tools are not the application. Refuse to publish documentation as an app.
  const manifest = new URL('../package.json', import.meta.url);
  try { await access(manifest); } catch {
    console.error('Deploy blocked: application is not merged into main yet (PR #14 / issue #11).');
    process.exit(1);
  }
  const app = JSON.parse(await readFile(manifest, 'utf8'));
  if (!app.scripts?.build) {
    console.error('Deploy blocked: application package.json with build script does not exist yet (issue #11).');
    process.exit(1);
  }
  const { VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID } = process.env;
  const api = async (path, options = {}) => {
    const url = new URL(`https://api.vercel.com${path}`);
    url.searchParams.set('teamId', VERCEL_ORG_ID);
    const response = await fetch(url, { ...options,
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error();
    return response.json();
  };
  const deployment = await api('/v13/deployments', { method: 'POST', body: JSON.stringify({
    name: 'world-pulse', project: VERCEL_PROJECT_ID, target: 'production',
    gitSource: { type: 'github', repoId: process.env.GITHUB_REPOSITORY_ID, ref: process.env.GITHUB_SHA },
  }) });
  console.log(`Production deployment requested: ${deployment.id}`);
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    const status = await api(`/v13/deployments/${encodeURIComponent(deployment.id)}`);
    if (['ERROR', 'CANCELED'].includes(status.readyState)) throw new Error();
    if (status.readyState === 'READY') { ready = true; break; }
    await setTimeout(10_000);
  }
  if (!ready) throw new Error();
  const response = await fetch('https://map.faysk.dev', { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
  if (response.status !== 200) throw new Error();
  console.log('Production deployment READY; map.faysk.dev HTTPS returned 200.');
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `Deployment: ${deployment.id}\n\nCommit: ${process.env.GITHUB_SHA}\n\n[Production](https://map.faysk.dev)\n`);
} catch {
  console.error('Deploy failed: check app build script, Vercel access, deployment status and DNS/TLS. Provider response suppressed.');
  process.exitCode = 1;
}
