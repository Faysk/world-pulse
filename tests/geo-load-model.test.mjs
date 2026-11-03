import test from 'node:test';
import assert from 'node:assert/strict';
import {REGIONS,PROFILE_POPULATIONS,distributeExact,modelGeoDemand,parseArgs,reportJSON} from '../scripts/geo-load-model.mjs';

test('exact distribution preserves all sizes through a trillion',()=>{
  for(const count of [...PROFILE_POPULATIONS,1000000000000n]){
    const regions=distributeExact(count);
    assert.equal(regions.length,REGIONS.length);
    assert.equal(regions.reduce((a,r)=>a+r.users,0n),count);
    assert.ok(regions.every(r=>r.users>=0n));
  }
});
test('simultaneous event puts all demand into one window',()=>{
  const report=modelGeoDemand({population:1000000000n});
  assert.equal(report.totalRequests,200000000n);
  assert.equal(report.perRegion.reduce((a,r)=>a+r.requests,0n),report.totalRequests);
  assert.equal(report.hourly[0].requests,report.totalRequests);
  assert.equal(report.peakModeledRps,report.singleWindowDemandRps);
});
test('local-midnight releases become regional waves',()=>{
  const report=modelGeoDemand({population:100000n,release:'rolling'});
  assert.ok(report.hourly.filter(r=>r.requests>0n).length>=4);
  assert.equal(report.hourly.reduce((a,r)=>a+r.requests,0n),report.totalRequests);
  assert.ok(report.peakModeledRps<=report.singleWindowDemandRps);
});
test('zero active population yields zero requests',()=>{
  const report=modelGeoDemand({population:1n,activeBasisPoints:0});
  assert.equal(report.totalRequests,0n);
});
test('argument validation and BigInt JSON',()=>{
  assert.equal(parseArgs(['--population=1000000000','--release=rolling']).population,1000000000n);
  assert.throws(()=>parseArgs(['--foo=123']),/unknown_argument/);
  assert.throws(()=>modelGeoDemand({population:1n,release:'wrong'}),/invalid_release/);
  assert.equal(JSON.parse(reportJSON(modelGeoDemand({population:1000n}))).population,'1000');
});
