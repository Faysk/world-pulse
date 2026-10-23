import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScenarioPopulation, POPULATION_SCENARIOS, MAX_SCENARIO_CELLS } from '../src/demoData.ts';

test('Every scenario preserves exact integer totals with bounded valid geometry in both distributions', () => {
  for (const distribution of ['distributed', 'concentrated']) {
    for (const total of [...POPULATION_SCENARIOS, 7, 32767, 999999999999]) {
      const data = createScenarioPopulation(total, distribution);
      assert.equal(data.features.reduce((sum, f) => sum + f.properties.people, 0), total);
      assert.ok(data.features.length <= MAX_SCENARIO_CELLS);
      for (const f of data.features) {
        assert.ok(Number.isSafeInteger(f.properties.people) && f.properties.people > 0);
        const [lng, lat] = f.geometry.coordinates;
        assert.ok(Number.isFinite(lng) && Math.abs(lng) <= 180);
        assert.ok(Number.isFinite(lat) && Math.abs(lat) <= 85);
      }
      assert.deepEqual(createScenarioPopulation(total, distribution), data);
    }
  }
  assert.equal(createScenarioPopulation(0).features.length, 0);
  assert.equal(createScenarioPopulation(1).features.length, 1);
});

test('Concentrating regions preserves each hashtag total', () => {
  for (const total of POPULATION_SCENARIOS) {
    const totals = distribution => Object.fromEntries(['gta6', 'minecraft', 'lofi'].map(tag =>
      [tag, createScenarioPopulation(total, distribution).features.reduce((s, f) => s + (f.properties.tag === tag ? f.properties.people : 0), 0)]));
    assert.deepEqual(totals('distributed'), totals('concentrated'));
  }
});

test('Reject invalid population inputs instead of silently rounding or allocating huge arrays', () => {
  for (const n of [-1, 0.5, NaN, Infinity, 1000000000001, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => createScenarioPopulation(n), RangeError);
  }
  assert.throws(() => createScenarioPopulation(1, 'invalid'), RangeError);
});
