import { createScenarioPopulation, POPULATION_SCENARIOS } from '../src/demoData.ts';

// Measures only synthetic GeoJSON generation, not WebGL or backend capacity.
for (const distribution of ['distributed', 'concentrated']) {
  for (const total of POPULATION_SCENARIOS) {
    const times = [];
    let data;
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      data = createScenarioPopulation(total, distribution);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    console.log(JSON.stringify({ distribution, total, cells: data.features.length,
      bytes: Buffer.byteLength(JSON.stringify(data)), medianMs: +times[50].toFixed(3), p95Ms: +times[95].toFixed(3) }));
  }
}
