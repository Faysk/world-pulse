import test from 'node:test';
import assert from 'node:assert/strict';
import {regionCell,regionCenter} from '../server/regionGrid.mjs';
import {route} from '../server/handlers.mjs';
import {newSession,tokenHash} from '../server/protocol.mjs';
test('Regional grid bounds, quantization, dateline and poles; center is never raw input',()=>{
  for(const [lat,lon]of [[38.72,-9.14],[41.15,-8.61],[90,180],[-90,-180],[0,180],[0,-180]]){
    const cell=regionCell(lat,lon),center=regionCenter(cell);
    assert.equal(regionCell(center[1],center[0]),cell);
    assert.notDeepEqual(center,[lon,lat]);
    assert.ok(center[0]>=-180&&center[0]<=180&&center[1]>=-90&&center[1]<=90);
  }
  assert.equal(regionCell(38.72001,-9.14001),regionCell(38.72002,-9.14002));
  for(const args of [[NaN,0],[0,Infinity],[91,0],[0,-181]])assert.throws(()=>regionCell(...args));
  for(const cell of ['r1:360:0','r1:0:999','r1:01:2','r2:20040:0','r2:0:3','r2:01:0','r3:1:2',{},null,'38.72,-9.14'])assert.throws(()=>regionCenter(cell));
});
function res(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},end(s){this.payload=JSON.parse(s);}};}
const session=newSession();
const request=body=>({method:'POST',body,headers:{cookie:'wp_session='+session.token,'x-wp-session-binding':tokenHash('world-pulse-queue-binding-v1:'+session.token),origin:'https://map.faysk.dev',host:'map.faysk.dev'}});
const operations={consumeApiBudget:async()=>{},requireVisitor:async()=>({id:'private-id'}),setRegionCell:async()=>{}};
process.env.WP_API_ENABLED='true';process.env.WP_GEO_PUBLIC_ENABLED='true';
test('Location API accepts only coarse cells or withdrawal, rejects exact coordinates and extra fields',async()=>{
  const received=[];
  for(const body of [{cell:regionCell(38.72,-9.14)},{cell:null}]){
    const r=res();await route('location',{...operations,setRegionCell:async(id,cell)=>received.push([id,cell])})(request(body),r);
    assert.equal(r.code,200);assert.deepEqual(r.payload,{regionCell:body.cell,geoConsent:body.cell!==null,geoCountry:'ZZ'});
  }
  assert.equal(received.length,2);
  process.env.WP_GEO_PUBLIC_ENABLED='false';
  const off=res();await route('location',operations)(request({cell:null}),off);assert.equal(off.code,200);
  const blocked=res();await route('location',operations)(request({cell:regionCell(38.72,-9.14)}),blocked);assert.equal(blocked.code,503);
  const read=res();await route('regions',operations)({method:'GET',headers:{}},read);assert.equal(read.code,503);
  process.env.WP_GEO_PUBLIC_ENABLED='true';
  const rotated=res(),bad=request({cell:null});bad.headers['x-wp-session-binding']='0'.repeat(64);
  await route('location',operations)(bad,rotated);assert.equal(rotated.code,409);
  for(const body of [{latitude:38.72,longitude:-9.14},{cell:'r1:999:1'},{cell:'r1:257:266',latitude:38},{cell:55},{}]){
    const r=res();await route('location',operations)(request(body),r);assert.equal(r.code,400);
  }
  const r=res();await route('location',operations)({...request({cell:null}),headers:{host:'map.faysk.dev',origin:'https://attacker.invalid'}},r);assert.equal(r.code,403);
});

test('One-km grid has bounded displacement globally while legacy centers stay unchanged',()=>{
  const rad=x=>x*Math.PI/180;
  const distance=(a,b)=>{const lat=rad(b[1]-a[1]),lon=rad(b[0]-a[0]);return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(lat/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(lon/2)**2)));};
  assert.deepEqual(regionCenter('r1:257:266'),[-9.288256227758012,38.75]);
  assert.notEqual(regionCell(38.72,-9.14),regionCell(38.74,-9.14));
  // Public locality reference, not a user's coordinates: Getty TGN 7743567.
  const cete=[-8.3649,41.1826];
  assert.ok(distance(cete,regionCenter('r1:262:257'))>20);
  assert.ok(distance(cete,regionCenter(regionCell(cete[1],cete[0])))<1);
  for(const lat of [-90,-89.999,-89.995,-89.991,-89.98,-80,-60,-30,0,30,60,80,89.98,89.991,89.995,89.999,90]){
    for(let lon=-180;lon<=180;lon+=.9){
      const cell=regionCell(lat,lon),center=regionCenter(cell);
      assert.match(cell,/^r2:/);assert.equal(regionCell(center[1],center[0]),cell);
      assert.ok(distance([lon,lat],center)<1.1,'cell-center displacement is bounded, including polar caps');
    }
  }
});
