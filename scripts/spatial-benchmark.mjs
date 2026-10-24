import { performance } from 'node:perf_hooks';
import { createScenarioPopulation } from '../src/demoData.ts';
import { aggregateForZoom } from '../src/spatialAggregation.ts';

// CPU + JSON serialization only. This is NOT a WebGL FPS, bandwidth or DB test.
const scenarios = [0, 1, 100, 10000, 100000, 1000000000, 1000000000000];
const budgets = [64, 160, 300];
const zooms = [1.5, 5, 10];
const iterations = 30;
const quantile = (sorted, q) => sorted[Math.ceil((sorted.length-1)*q)];
console.log('total,distribution,zoom,budget,sourceCells,outputCells,gridZoom,sourceBytes,outputBytes,p50ms,p95ms');
for (const total of scenarios) {
 for (const distribution of ['distributed','concentrated']) {
  const source = createScenarioPopulation(total,distribution);
  const originalBytes = Buffer.byteLength(JSON.stringify(source));
  for (const zoom of zooms) for (const maxCells of budgets) {
   const timings = []; let result;
   for (let i=0;i<iterations;i++) {
    const start=performance.now();
    result=aggregateForZoom(source,{zoom,maxCells});
    timings.push(performance.now()-start);
   }
   timings.sort((a,b)=>a-b);
   if (result.totalPeople !== total || result.outputCells > maxCells) throw Error('Total/budget invariant violated');
   const packedBytes=Buffer.byteLength(JSON.stringify(result.population));
   console.log([total,distribution,zoom,maxCells,source.features.length,result.outputCells,result.cellZoom,originalBytes,packedBytes,quantile(timings,.5).toFixed(3),quantile(timings,.95).toFixed(3)].join(','));
  }
 }
}
