import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TAGS, createScenarioPopulation, createCombinedPopulation, POPULATION_SCENARIOS
} from '../src/demoData.ts';
import { aggregateForZoom, describeOverlaps } from '../src/spatialAggregation.ts';

const sum = features => features.reduce((s, f) => s + f.properties.people, 0);
const perTag = features => Object.fromEntries(TAGS.map(tag => [
  tag.id,
  features.filter(f => f.properties.tag === tag.id).reduce((s, f) => s + f.properties.people, 0)
]));

test('All 0–1 trillion simulated counts are conserved at every tested zoom', () => {
  for (const total of POPULATION_SCENARIOS) {
    for (const distribution of ['distributed', 'concentrated']) {
      const source = createScenarioPopulation(total, distribution);
      for (const zoom of [0, 1.65, 4, 8, 14]) {
        const grouped = aggregateForZoom(source, { zoom, maxCells: 125 });
        assert.equal(grouped.totalPeople, total, `${total} / ${distribution} / ${zoom}`);
        assert.ok(grouped.outputCells <= 125);
        assert.equal(sum(grouped.population.features), total);
        assert.deepEqual(perTag(grouped.population.features), perTag(source.features));
        assert.ok(grouped.population.features.every(x =>
          Number.isFinite(x.geometry.coordinates[0]) &&
          Number.isFinite(x.geometry.coordinates[1]) &&
          x.geometry.coordinates[0] >= -180 && x.geometry.coordinates[0] < 180 &&
          Math.abs(x.geometry.coordinates[1]) <= 85.05113
        ));
      }
    }
  }
});

test('At high zoom, lower cell budgets coarsen safely instead of dropping people', () => {
  const source = createCombinedPopulation(5);
  const detailed = aggregateForZoom(source, { zoom: 14, maxCells: 5000 });
  const cheap = aggregateForZoom(source, { zoom: 14, maxCells: 20 });
  assert.equal(detailed.totalPeople, cheap.totalPeople);
  assert.ok(cheap.cellZoom < detailed.cellZoom);
  assert.ok(cheap.coarsenedLevels > 0);
  assert.ok(cheap.outputCells <= 20);
  assert.deepEqual(perTag(detailed.population.features), perTag(cheap.population.features));
});

test('Sorted cells and competing colors are independent of source order', () => {
  const source = createScenarioPopulation(1_000_000_000, 'concentrated');
  const reversed = { ...source, features: [...source.features].reverse() };
  const first = aggregateForZoom(source, { zoom: 1.65, maxCells: 48 });
  const second = aggregateForZoom(reversed, { zoom: 1.65, maxCells: 48 });
  assert.deepEqual(first, second);
  const collision = describeOverlaps(first);
  assert.ok(collision.length > 0);
  assert.deepEqual(collision, describeOverlaps(second));
  for (const cell of collision) {
    const sum = cell.participants.reduce((s, p) => s + p.people, 0);
    assert.equal(cell.totalPeople, sum);
    assert.ok(Math.abs(cell.participants.reduce((s, p) => s + p.share, 0) - 1) < 1e-10);
    assert.ok(cell.participants.every(p => p.color.startsWith('#') && p.color !== '#ffffff'));
    assert.deepEqual(cell.participants.map(p => p.tag), [...cell.participants.map(p => p.tag)].sort());
  }
});

test('Exact geographic centroid is never returned; each result uses a tile center', () => {
  const original = createCombinedPopulation(1);
  const grouped = aggregateForZoom(original, { zoom: 2, maxCells: 50 });
  assert.ok(grouped.population.features.length > 0);
  assert.ok(grouped.population.features.every(f => f.properties.city.includes('Célula regional')));
  const sourceCoords = new Set(original.features.map(f => f.geometry.coordinates.join(',')));
  // Some cell centers could accidentally coincide; require at least one moved.
  assert.ok(grouped.population.features.some(f => !sourceCoords.has(f.geometry.coordinates.join(','))));
});

test('No false participants or cells are fabricated for empty activity', () => {
  const empty = createScenarioPopulation(0, 'distributed');
  const result = aggregateForZoom(empty, { zoom: 5, maxCells: 1 });
  assert.deepEqual(result.population.features, []);
  assert.equal(result.totalPeople, 0);
  assert.equal(result.outputCells, 0);
  assert.deepEqual(describeOverlaps(result), []);
});

test('Impossible budgets and invalid counts fail explicitly', () => {
  const source = createScenarioPopulation(1000);
  assert.throws(() => aggregateForZoom(source, { zoom: 2, maxCells: 1 }), /budget/i);
  for (const invalid of [-1, NaN, Infinity, 24.1]) {
    assert.throws(() => aggregateForZoom(source, { zoom: invalid }), RangeError);
  }
  assert.throws(() => aggregateForZoom(source, { zoom: 4, maxCells: 0 }), RangeError);
  const bad = structuredClone(source);
  bad.features[0].properties.people = -3;
  assert.throws(() => aggregateForZoom(bad, { zoom: 4 }), RangeError);
});

test('Dateline wrap and polar clamping produce finite canonical coordinates', () => {
  const source = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [179.999, 89] },
        properties: { tag: 'gta6', color: '#ff8758', people: 10, city: 'synthetic' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-179.999, -89] },
        properties: { tag: 'gta6', color: '#ff8758', people: 12, city: 'synthetic' } }
    ]
  };
  const result = aggregateForZoom(source, { zoom: 10 });
  assert.equal(result.totalPeople, 22);
  assert.ok(result.population.features.every(f => f.geometry.coordinates.every(Number.isFinite)));
});
