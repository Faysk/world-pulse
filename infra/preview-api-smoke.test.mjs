import test from 'node:test';
import assert from 'node:assert/strict';
import {smokePreviewApi} from './preview-api-smoke.mjs';
test('preview smoke refuses foreign origin and never follows a cross-origin protection redirect',async()=>{
  const calls=[];const fetcher=async url=>{calls.push(String(url));return new Response(null,{status:302,headers:{Location:'https://foreign.example/'}});};
  await assert.rejects(smokePreviewApi('https://foreign.example','private',new Set(),fetcher));assert.equal(calls.length,0);
  await assert.rejects(smokePreviewApi('https://world-pulse-test.vercel.app','private',new Set(),fetcher));assert.equal(calls.length,1);
});
test('GET authenticates protection before API POST and emitted fixture hash is retained even if cookie validation fails',async()=>{
  const calls=[],hashes=new Set();const fetcher=async(url,options)=>{
    calls.push({url:String(url),method:options.method});
    if(new URL(url).pathname==='/')return new Response('<html/>',{headers:{'Set-Cookie':'protection=disposable; Path=/; Secure; HttpOnly'}});
    assert.match(options.headers.Cookie,/protection=disposable/);
    return Response.json({sessionFresh:true,sessionBinding:'binding'},{headers:{'Set-Cookie':'wp_session='+'a'.repeat(43)+'; Path=/; HttpOnly; SameSite=Lax'}});
  };
  await assert.rejects(smokePreviewApi('https://world-pulse-test.vercel.app','private',hashes,fetcher));
  assert.deepEqual(calls.map(row=>row.method),['GET','POST']);assert.equal(hashes.size,1);assert.match([...hashes][0],/^[a-f0-9]{64}$/);
});
