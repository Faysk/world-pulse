import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {setTimeout as pause} from 'node:timers/promises';
/** Exact HTTPS deployment only; no cookies or provider access sent to other origins. */
export async function smokePreviewApi(origin,secret,createdHashes,fetcher=fetch,{countrySource=false}={}){
  const base=new URL(origin);
  if(base.protocol!=='https:'||!/^world-pulse-[a-z0-9-]+\.vercel\.app$/.test(base.hostname)||base.pathname!=='/')throw new Error('preview_smoke_origin_rejected');
  function session(){
    const cookies=new Map();let binding,authorized=false;
    async function request(path,body,json=true,geoHeaders={}){
      const url=new URL(path,base);assert.equal(url.origin,base.origin);
      if(!cookies.size)url.searchParams.set('_vercel_share',secret);
      for(let redirects=0;redirects<4;redirects++){
        const response=await fetcher(url,{method:body===undefined?'GET':'POST',redirect:'manual',signal:AbortSignal.timeout(30000),
          headers:{Origin:base.origin,'Content-Type':'application/json',Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...(['/api/taps','/api/location'].includes(path)?{'X-WP-Session-Binding':binding??''}:{}),...geoHeaders},
          ...(body===undefined?{}:{body:JSON.stringify(body)})});
        const setCookies=response.headers.getSetCookie();
        for(const cookie of setCookies){
          const pair=cookie.split(';')[0],split=pair.indexOf('=');if(split<1)continue;
          const name=pair.slice(0,split),value=pair.slice(split+1);cookies.set(name,value);
          if(name==='wp_session'){
            createdHashes.add(createHash('sha256').update(value).digest('hex'));
            assert.match(cookie,/;\s*Secure/i);assert.match(cookie,/;\s*HttpOnly/i);assert.match(cookie,/;\s*SameSite=Lax/i);
          }
        }
        if(response.status>=300&&response.status<400){
          const next=new URL(response.headers.get('location'),url);assert.equal(next.origin,base.origin);url.href=next.href;continue;
        }
        if(response.status===503&&body===undefined&&['/api/regions','/api/countries','/api/ranking'].includes(path)&&redirects<3){await response.body?.cancel();await pause(1000);continue;}
        if(response.status!==200){const error=new Error('preview_http_'+response.status);error.operation=path;throw error;}
        if(!json)return response.text();
        const value=await response.json();
        if(path==='/api/session')binding=value.sessionBinding;
        return value;
      }
      throw new Error('preview_redirect_limit');
    }
    return {async call(path,body,geoHeaders={}){
      if(!authorized){await request('/',undefined,false);authorized=true;}
      return request(path,body,true,geoHeaders);
    }};
  }
  const first=session(),second=session();
  const a=await first.call('/api/session',{}),b=await second.call('/api/session',{});
  assert.equal(a.sessionFresh,true);assert.equal(b.sessionFresh,true);assert.notEqual(a.sessionBinding,b.sessionBinding);
  const name='preview_'+randomUUID().slice(0,8),otherName='preview_'+randomUUID().slice(0,8);
  const tagA=(await first.call('/api/tags',{name})).tag,tagB=(await second.call('/api/tags',{name})).tag;
  assert.equal(tagA.id,tagB.id);assert.equal(tagA.color,tagB.color);
  await first.call('/api/select',{tagId:tagA.id});await second.call('/api/select',{tagId:tagA.id});
  const batch={tagId:tagA.id,batchId:randomUUID(),clicks:30};
  const accepted=await first.call('/api/taps',batch);assert.equal(accepted.creditedSeconds,'30');
  // Deliberately retry the same committed payload, as after a lost response.
  const retry=await first.call('/api/taps',batch);assert.equal(retry.duplicate,true);assert.equal(retry.creditedSeconds,'30');assert.equal(retry.expiresAtMs,accepted.expiresAtMs);
  assert.equal((await second.call('/api/taps',{tagId:tagA.id,batchId:randomUUID(),clicks:15})).creditedSeconds,'15');
  assert.equal(a.regionCell,null);assert.equal(b.regionCell,null);
  const cell='r1:257:266'; // Disposable fixture region, never a production participant.
  assert.equal((await first.call('/api/location',{cell})).geoConsent,true);assert.equal((await second.call('/api/location',{cell})).geoConsent,true);
  assert.equal((await first.call('/api/regions')).cells.find(row=>row.tagId===tagA.id)?.participants,'2');
  assert.equal((await first.call('/api/location',{cell:null})).geoConsent,false);
  assert.equal((await second.call('/api/regions')).cells.find(row=>row.tagId===tagA.id)?.participants,'1');
  assert.equal((await second.call('/api/location',{cell:null})).geoConsent,false);
  assert.equal((await first.call('/api/regions')).cells.filter(row=>row.tagId===tagA.id).length,0);
  const other=(await first.call('/api/tags',{name:otherName})).tag;await first.call('/api/select',{tagId:other.id});
  await first.call('/api/taps',{tagId:other.id,batchId:randomUUID(),clicks:2});
  const restored=await first.call('/api/session',{});assert.equal(restored.activeTag.id,other.id);
  assert.equal(restored.credits.find(row=>row.tagId===tagA.id).creditedSeconds,'30');
  assert.equal(restored.credits.find(row=>row.tagId===other.id).creditedSeconds,'2');
  const shared=await first.call('/api/session',{geoConsent:true});
  if(countrySource){
    assert.match(shared.geoCountry,/^[A-Z]{2}$/);assert.notEqual(shared.geoCountry,'ZZ');
    const spoofed=await first.call('/api/session',{geoConsent:true},{'X-Vercel-IP-Country':'AQ','CF-IPCountry':'AQ','X-Forwarded-For':'198.51.100.7'});
    assert.equal(spoofed.geoCountry,shared.geoCountry,'edge_country_spoof_rejected');
  }else assert.equal(shared.geoCountry,'ZZ');
  assert.equal((await first.call('/api/session',{geoConsent:false})).geoConsent,false);
  assert.equal((await first.call('/api/ranking')).type,'active');
  assert.equal((await first.call('/api/countries')).type,'country_snapshot');
  assert.equal(createdHashes.size,2);
}
