import test from 'node:test';
import assert from 'node:assert/strict';
import {capacityConfiguration,pathsFor,summarizeRequests,assertHealthyBurst} from './capacity-model.mjs';
test('capacity harness refuses remote credentials and unknown workloads',()=>{
  const env={WP_CAPACITY_BENCHMARK:'1'};
  assert.deepEqual(capacityConfiguration(env),{profile:'map',mode:'burst'});
  for(const patch of [{WP_CAPACITY_BENCHMARK:''},{DATABASE_URL:'remote'},{DATABASE_MIGRATION_URL:'owner'},{VERCEL_TOKEN:'token'},{R2_BACKUP_SECRET_ACCESS_KEY:'secret'},{WP_CAPACITY_PROFILE:'other'},{WP_CAPACITY_MODE:'other'}])assert.throws(()=>capacityConfiguration({...env,...patch}));
  assert.deepEqual(pathsFor('map-ranking'),['/api/regions','/api/ranking']);
});
test('healthy burst guard rejects cache errors and budget denial instead of hiding them in latency',()=>{
  const report={configuration:{mode:'burst'},results:[{requests:10,statuses:{200:10}}]};
  assert.doesNotThrow(()=>assertHealthyBurst(report));
  for(const patch of [{statuses:{200:9,503:1}},{statuses:{200:9,429:1}},{requests:0,statuses:{}}])assert.throws(()=>assertHealthyBurst({...report,results:[{...report.results[0],...patch}]}),/capacity_burst_unhealthy/);
  assert.throws(()=>assertHealthyBurst({...report,configuration:{mode:'cadence'}}));
});
test('latencies use nearest rank and errors remain separate from successful reads',()=>{
  const result=summarizeRequests([{ms:9,status:200,bytes:100},{ms:1,status:429,error:'operation_budget_exhausted',bytes:20},{ms:4,status:503,error:'geography_refreshing',bytes:30}]);
  const {latencyByStatus,...overall}=result;
  assert.deepEqual(overall,{requests:3,statuses:{200:1,429:1,503:1},errors:{operation_budget_exhausted:1,geography_refreshing:1},decodedJsonBytes:150,latencyMs:{p50:4,p95:9,p99:9,max:9}});
  assert.equal(latencyByStatus[200].p95,9);assert.equal(latencyByStatus[429].p95,1);assert.equal(latencyByStatus[503].p95,4);
  assert.equal(summarizeRequests([]).latencyMs.p95,null);
});
