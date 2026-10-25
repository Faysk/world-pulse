/** Keep promotion unreachable until the staged site and its assets have passed. */
export async function stagedRelease({ api, smoke, sha, project, repo, pause, receipt = () => {}, progress = () => {} }) {
  const candidate = await api('/v13/deployments', { method: 'POST', body: JSON.stringify({
    name: 'world-pulse', project, target: 'production', autoAssignCustomDomains: false,
    gitSource: { type: 'github', repoId: repo, ref: sha },
  }) });
  if (!candidate.id) throw new Error('Deployment did not return an ID');
  receipt(candidate.id);
  let ready;
  for (let i = 0; i < 90; i++) {
    const status = await api(`/v13/deployments/${encodeURIComponent(candidate.id)}`);
    if (['ERROR', 'CANCELED'].includes(status.readyState)) throw new Error('Candidate build failed');
    if (status.readyState === 'READY') { ready = status; break; }
    await pause(10_000);
  }
  if (!ready) throw new Error('Candidate build timed out');
  progress('Candidate build READY; checking domain assignment and temporary access.');
  if (ready.autoAssignCustomDomains !== false) throw new Error('Candidate did not confirm disabled domain assignment');
  progress('Candidate automatic domain assignment is disabled.');
  const host = ready.url || candidate.url;
  if (!/^[a-z0-9-]+\.vercel\.app$/.test(host || '')) throw new Error('Unexpected candidate hostname');

  let secret;
  try {
    progress('Requesting temporary access for the isolated candidate.');
    const share = await api(`/aliases/${encodeURIComponent(candidate.id)}/protection-bypass`, {
      method: 'PATCH', body: JSON.stringify({ ttl: 600 }),
    });
    secret = Object.entries(share.protectionBypass || {}).find(([, value]) => value.scope === 'shareable-link')?.[0];
    if (!secret) throw new Error('Temporary candidate access unavailable');
    progress('Temporary candidate access granted; starting HTML and asset smoke.');
    // Newly-created access can take a moment to reach the deployment edge.
    // Never promote unless one complete page + asset pass succeeds.
    for (let attempt = 0; ; attempt++) {
      try { await smoke(`https://${host}`, secret); break; }
      catch (error) {
        if (attempt >= 3) throw error;
        progress('Candidate smoke not ready; retrying after a bounded propagation delay.');
        await pause(2_000);
      }
    }
    progress('Candidate HTML, JavaScript and CSS passed smoke checks.');
  } finally {
    if (secret) {
      progress('Revoking temporary candidate access.');
      await api(`/aliases/${encodeURIComponent(candidate.id)}/protection-bypass`, {
      method: 'PATCH', body: JSON.stringify({ revoke: { secret, regenerate: false } }),
      });
    }
  }
  // The access token is revoked BEFORE assigning the production domain.
  progress('Temporary candidate access revoked; requesting promotion.');
  await api(`/v10/projects/${encodeURIComponent(project)}/promote/${encodeURIComponent(candidate.id)}`, {
    method: 'POST', body: '{}',
  });
  let promoted = false;
  for (let i = 0; i < 30; i++) {
    const state = await api(`/v9/projects/${encodeURIComponent(project)}`);
    if (state.targets?.production?.id === candidate.id) { promoted = true; break; }
    await pause(2_000);
  }
  if (!promoted) throw new Error('Promotion did not confirm the expected deployment');
  await smoke('https://map.faysk.dev');
  return candidate.id;
}

export class SmokeCheckError extends Error {}

export async function smokeStaticSite(origin, secret, fetcher = fetch, {ignorePreviewToolbar=false} = {}) {
  const base = new URL(origin);
  const cookies = new Map();
  const request = async (path) => {
    let url = new URL(path, base);
    if (url.origin !== base.origin) throw new SmokeCheckError('Cross-origin asset refused');
    for (let redirects = 0; redirects < 4; redirects++) {
      if (secret && !cookies.size) url.searchParams.set('_vercel_share', secret);
      const response = await fetcher(url, { redirect: 'manual',
        headers: cookies.size ? { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {},
        signal: AbortSignal.timeout(30_000),
      });
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(';')[0], split = pair.indexOf('=');
        if (split > 0) cookies.set(pair.slice(0, split), pair.slice(split + 1));
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new SmokeCheckError('Redirect without location');
        url = new URL(location, url);
        if (url.origin !== base.origin) throw new SmokeCheckError('Cross-origin redirect refused');
        continue;
      }
      if (response.status !== 200) throw new SmokeCheckError(`Site or asset HTTP status: ${response.status}`);
      return response;
    }
    throw new SmokeCheckError('Too many redirects');
  };
  const page = await request('/');
  if (!page.headers.get('content-type')?.includes('text/html')) throw new SmokeCheckError('Not an HTML page');
  const html = await page.text();
  if (!html.includes('World Pulse') || !html.includes('id="root"')) throw new SmokeCheckError('Unexpected application page');
  const assets = [...html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g)].map(match => match[1]);
  if (!assets.some(path => path.endsWith('.js')) || !assets.some(path => path.endsWith('.css'))) {
    throw new SmokeCheckError('Application bundle references missing');
  }
  for (const path of new Set(assets)) {
    // Provider-injected preview toolbar is not an app bundle. Never fetch it or send access/cookies there.
    if(ignorePreviewToolbar&&path==='https://vercel.live/_next-live/feedback/feedback.js')continue;
    const asset = await request(path);
    const type = asset.headers.get('content-type') || '';
    if (path.endsWith('.js') ? !/(?:javascript|ecmascript)/.test(type) : !type.includes('text/css')) {
      throw new SmokeCheckError('Unexpected asset content type');
    }
    if (!(await asset.text()).trim()) throw new SmokeCheckError('Empty application asset');
  }
}
