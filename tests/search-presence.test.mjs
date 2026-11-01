import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {searchHead,searchPresence,discoveryFiles,aboutPages,renderAbout,siteOrigin} from '../build/search-presence.mjs';

test('only explicit public production release permits indexing and emits real canonical pages',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  for(const [env,indexable]of [[{},false],[{VERCEL_ENV:'preview',WP_ALPHA_RELEASE:'true'},false],[{VERCEL_ENV:'production'},false],[{VERCEL_ENV:'production',WP_ALPHA_RELEASE:'true'},true]]){
    const plugin=searchPresence(env),result=plugin.transformIndexHtml(html),assets=[];
    assert.ok(!result.includes('<!-- wp:search-head -->'));
    assert.match(result,indexable?/name="robots" content="index, follow/:/name="robots" content="noindex, nofollow/);
    plugin.generateBundle.call({emitFile:asset=>assets.push(asset)});
    assert.equal(assets.length,5);
    const files=Object.fromEntries(assets.map(a=>[a.fileName,a.source]));
    assert.equal(files['robots.txt'],discoveryFiles(indexable)['robots.txt']);
    assert.equal((files['sitemap.xml'].match(/<loc>/g)??[]).length,indexable?4:0);
    for(const page of aboutPages){assert.ok(files[page.path.slice(1)+'index.html'].includes(`<html lang="${page.lang}">`));assert.match(files[page.path.slice(1)+'index.html'],indexable?/content="index, follow/:/content="noindex, nofollow/);}
  }
  const files=discoveryFiles(true);
  assert.match(files['robots.txt'],/Disallow: \/api\//);assert.match(files['robots.txt'],/Sitemap: https:\/\/map\.faysk\.dev\/sitemap.xml/);
  assert.ok(!files['sitemap.xml'].includes('/api/'));
  for(const [,url]of files['sitemap.xml'].matchAll(/<loc>(.*?)<\/loc>/g))assert.equal(new URL(url).search,'');
});

test('canonical, social metadata and structured data describe the public app without invented ratings or search endpoints',()=>{
  const head=searchHead({indexable:true});
  assert.equal((head.match(/rel="canonical"/g)??[]).length,1);
  assert.match(head,/href="https:\/\/map\.faysk\.dev\/"/);
  for(const name of ['og:title','og:description','og:url','og:image','og:image:width','og:image:height','twitter:card','twitter:image'])assert.ok(head.includes('"'+name+'"'));
  assert.match(head,/content="1200"/);assert.match(head,/content="630"/);
  const schema=JSON.parse(head.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.equal(schema['@graph'][0].url,siteOrigin+'/');assert.equal(schema['@graph'][1]['@type'],'WebApplication');
  assert.ok(!head.includes('aggregateRating'));assert.ok(!head.includes('SearchAction'));
  assert.ok(!head.includes('hreflang='),'dynamic map has no fake language URLs');
});

test('localized about pages have accessible real content, reciprocal language links and accurate privacy',()=>{
  for(const page of aboutPages){
    const html=renderAbout(page,true);
    assert.equal((html.match(/<h1>/g)??[]).length,1);assert.ok(!html.includes('<script'));
    assert.ok(html.includes(`rel="canonical" href="${siteOrigin+page.path}"`));
    for(const alternative of aboutPages)assert.ok(html.includes(`hreflang="${alternative.lang}" href="${siteOrigin+alternative.path}"`));
    assert.ok(html.includes('1 km'));assert.ok(html.includes('30'));assert.ok(html.includes('https://github.com/Faysk/world-pulse'));
  }
});

test('icons, manifest and social image exist at declared sizes; ICO has all browser sizes',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/site.webmanifest',import.meta.url),'utf8'));
  assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.id,'/');
  const images=[['/icons/icon-48.png',48,48],['/icons/icon-180.png',180,180],['/social-card.png',1200,630],...manifest.icons.map(icon=>[icon.src,...icon.sizes.split('x').map(Number)])];
  for(const [path,width,height]of images){
    const png=await readFile(new URL('../public'+path,import.meta.url));
    assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);
  }
  const ico=await readFile(new URL('../public/favicon.ico',import.meta.url));assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);
  for(const [i,size]of [16,32,48].entries()){assert.equal(ico[6+i*16],size);assert.ok(ico.readUInt32LE(6+i*16+12)<ico.length);}
  assert.ok(manifest.icons.some(icon=>icon.purpose==='maskable'));
});
