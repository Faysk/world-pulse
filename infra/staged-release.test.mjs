import test from 'node:test';
import assert from 'node:assert/strict';
import { stagedRelease, smokeStaticSite } from './staged-release.mjs';

function fixture({ smokeFails = false, transientFailures = 0, cleanupFails = false, state = 'READY' } = {}) {
  const calls = [];
  const api = async (path, options = {}) => {
    const body = options.body && JSON.parse(options.body);
    calls.push({ path, body });
    if (path === '/v13/deployments') return { id: 'dpl_test', url: 'candidate.vercel.app' };
    if (path === '/v13/deployments/dpl_test') return { readyState: state, autoAssignCustomDomains: false, url: 'candidate.vercel.app' };
    if (path.includes('protection-bypass')) {
      if (body.revoke && cleanupFails) throw new Error('cleanup failed');
      return body.revoke ? {} : { protectionBypass: { temporary: { scope: 'shareable-link' } } };
    }
    if (path === '/v9/projects/project') return { targets: { production: { id: 'dpl_test' } } };
    return {};
  };
  const smoke = async (origin, secret) => {
    calls.push({ smoke: origin, secret });
    if (smokeFails || transientFailures-- > 0) throw new Error('smoke failed');
  };
  return { calls, run: () => stagedRelease({ api, smoke, sha: 'commit', repo: 'repo', project: 'project', pause: async ms => { calls.push({ pause: ms }); } }) };
}

test('temporary edge propagation can recover, with bounded retries before revocation and promotion', async () => {
  const f = fixture({ transientFailures: 2 });
  await f.run();
  assert.equal(f.calls.filter(c => c.pause === 2000).length, 2);
  assert.equal(f.calls.filter(c => c.smoke === 'https://candidate.vercel.app').length, 3);
  assert.ok(f.calls.findIndex(c => c.body?.revoke) > f.calls.findLastIndex(c => c.smoke === 'https://candidate.vercel.app'));
});

test('candidate uses production config without automatic domains, then smoke, revoke, promote', async () => {
  const f = fixture();
  assert.equal(await f.run(), 'dpl_test');
  assert.equal(f.calls[0].body.autoAssignCustomDomains, false);
  assert.equal(f.calls[0].body.target, 'production');
  const smoke = f.calls.findIndex(c => c.smoke === 'https://candidate.vercel.app');
  const revoke = f.calls.findIndex(c => c.body?.revoke);
  const promote = f.calls.findIndex(c => c.path?.includes('/promote/'));
  assert.ok(smoke > 0 && revoke > smoke && promote > revoke);
  assert.equal(f.calls.at(-1).smoke, 'https://map.faysk.dev');
});
test('failed candidate smoke revokes access and never promotes', async () => {
  const f = fixture({ smokeFails: true });
  await assert.rejects(f.run());
  assert.equal(f.calls.filter(c => c.smoke === 'https://candidate.vercel.app').length, 4);
  assert.ok(f.calls.some(c => c.body?.revoke));
  assert.ok(!f.calls.some(c => c.path?.includes('/promote/')));
});
test('failed access revocation prevents promotion', async () => {
  const f = fixture({ cleanupFails: true });
  await assert.rejects(f.run());
  assert.ok(!f.calls.some(c => c.path?.includes('/promote/')));
});
test('build error never creates candidate access or requests promotion', async () => {
  const f = fixture({ state: 'ERROR' });
  await assert.rejects(f.run());
  assert.ok(!f.calls.some(c => c.path?.includes('protection-bypass') || c.path?.includes('/promote/')));
});
const html = '<title>World Pulse</title><div id="root"></div><script src="/assets/app.js"></script><link href="/assets/app.css">';
test('static smoke validates page and actual JS/CSS, sending temporary access only to its origin', async () => {
  const urls = [];
  await smokeStaticSite('https://candidate.vercel.app', 'temporary', async url => {
    urls.push(new URL(url));
    if (url.pathname === '/') return new Response(html, { headers: { 'Content-Type': 'text/html' } });
    return new Response('asset body', { headers: { 'Content-Type': url.pathname.endsWith('.js') ? 'application/javascript' : 'text/css' } });
  });
  assert.equal(urls.length, 3);
  assert.ok(urls.every(url => url.origin === 'https://candidate.vercel.app' && url.searchParams.get('_vercel_share') === 'temporary'));
});
test('login redirects, broken assets and external bundle URLs fail the smoke', async () => {
  await assert.rejects(smokeStaticSite('https://candidate.vercel.app', 'temporary', async () => new Response('', {
    status: 302, headers: { Location: 'https://vercel.com/login' },
  })));
  await assert.rejects(smokeStaticSite('https://candidate.vercel.app', null, async url => url.pathname === '/'
    ? new Response(html, { headers: { 'Content-Type': 'text/html' } }) : new Response('not found', { status: 404 })));
  let calls = 0;
  await assert.rejects(smokeStaticSite('https://candidate.vercel.app', 'temporary', async () => {
    calls++;
    return new Response(html.replace('/assets/app.js', 'https://external.example/app.js'), { headers: { 'Content-Type': 'text/html' } });
  }));
  assert.equal(calls, 1);
});
test('candidate access follows same-origin cookie redirect without reattaching the share token', async () => {
  let initial = true;
  await smokeStaticSite('https://candidate.vercel.app', 'temporary', async (url, options) => {
    if (initial) {
      initial = false;
      assert.equal(url.searchParams.get('_vercel_share'), 'temporary');
      return new Response('', { status: 302, headers: {
        Location: '/', 'Set-Cookie': '_vercel_jwt=authorized; HttpOnly; Secure; Path=/',
      } });
    }
    assert.equal(url.searchParams.has('_vercel_share'), false);
    assert.equal(options.headers.Cookie, '_vercel_jwt=authorized');
    if (url.pathname === '/') return new Response(html, { headers: { 'Content-Type': 'text/html' } });
    return new Response('asset', { headers: { 'Content-Type': url.pathname.endsWith('.js') ? 'application/javascript' : 'text/css' } });
  });
});

test('preview may skip only the exact provider toolbar without fetching it; production and foreign assets remain strict',async()=>{
  const toolbar='https://vercel.live/_next-live/feedback/feedback.js';
  for(const [external,preview,passes] of [[toolbar,true,true],[toolbar,false,false],['https://vercel.live.evil.example/_next-live/feedback/feedback.js',true,false]]){
    const calls=[];const fetcher=async url=>{
      calls.push(url.origin);assert.equal(url.origin,'https://candidate.vercel.app');
      if(url.pathname==='/')return new Response(html+`<script src="${external}"></script>`,{headers:{'Content-Type':'text/html'}});
      return new Response('asset',{headers:{'Content-Type':url.pathname.endsWith('.js')?'application/javascript':'text/css'}});
    };
    const result=smokeStaticSite('https://candidate.vercel.app','temporary',fetcher,{ignorePreviewToolbar:preview});
    if(passes)await result;else await assert.rejects(result,/Cross-origin asset refused/);
    assert.ok(calls.every(origin=>origin==='https://candidate.vercel.app'));
  }
});
