import test from 'node:test';
import assert from 'node:assert/strict';
import {capacityConfiguration,pathsFor,summarizeRequests} from './capacity-model.mjs';
test('capacity harness refuses remote credentials and unknown workloads',()=>{
  const env={WP_CAPACITY_BENCHMARK:'1'};
  assert.deepEqual(capacityConfiguration(env),{profile:'map',mode:'burst'});
  for(const patch of [{WP_CAPACITY_BENCHMARK:''},{DATABASE_URL:'remote'},{DATABASE_MIGRATION_URL:'owner'},{VERCEL_TOKEN:'token'},{R2_BACKUP_SECRET_ACCESS_KEY:'secret'},{WP_CAPACITY_PROFILE:'other'},{WP_CAPACITY_MODE:'other'}])assert.throws(()=>capacityConfiguration({...env,...patch}));
  assert.deepEqual(pathsFor('map-ranking'),['/api/regions','/api/ranking']);
});
test('latencies use nearest rank and errors remain separate from successful reads',()=>{
  const result=summarizeRequests([{ms:9,status:200,bytes:100},{ms:1,status:429,error:'operation_budget_exhausted',bytes:20},{ms:4,status:503,error:'geography_refreshing',bytes:30}]);
  assert.deepEqual(result,{requests:3,statuses:{200:1,429:1,503:1},errors:{operation_budget_exhausted:1,geography_refreshing:1},decodedJsonBytes:150,latencyMs:{p50:4,p95:9,p99:9,max:9}});
  assert.equal(summarizeRequests([]).latencyMs.p95,null);
});
