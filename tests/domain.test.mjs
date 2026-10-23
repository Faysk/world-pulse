import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creditTap, creditedTotal, EMPTY_SECONDS, peopleDensityWeight, heatVisibility, chooseHashtag } from '../src/domain.ts';
import { TAGS, createPopulation, peopleCount, neutralLightPoints } from '../src/demoData.ts';

test('A click credits exactly one second to the selected tag', () => {
  let state = { ...EMPTY_SECONDS };
  for (let i = 0; i < 100; i++) state = creditTap(state, 'gta6');
  assert.deepEqual(state, { gta6: 100, minecraft: 0, lofi: 0 });
  state = creditTap(state, 'minecraft');
  assert.deepEqual(state, { gta6: 100, minecraft: 1, lofi: 0 });
  state = creditTap(state, 'gta6');
  assert.equal(state.gta6, 101);
  assert.equal(creditedTotal(state), 102);
});

test('Tap without a selected hashtag does not credit anything', () => {
  const state = { ...EMPTY_SECONDS };
  assert.equal(creditTap(state, null), state);
});

test('Selecting another hashtag never resets credited seconds', () => {
  const original = { gta6: 10000, minecraft: 100, lofi: 0 };
  let current = chooseHashtag('gta6', 'minecraft');
  current = chooseHashtag(current, 'gta6');
  assert.equal(current, 'gta6');
  assert.equal(original.gta6, 10000);
  assert.equal(original.minecraft, 100);
});

test('Population counts are independent of taps and credits', () => {
  const initial = peopleCount('gta6', 1);
  const state = { gta6: 0, minecraft: 0, lofi: 0 };
  const after = Array.from({ length: 1000 }).reduce(credits => creditTap(credits, 'gta6'), state);
  assert.equal(after.gta6, 1000);
  assert.equal(peopleCount('gta6', 1), initial);
});

test('Synthetic data is deterministic and total count matches coordinates', () => {
  for (const tag of TAGS) {
    for (const scale of [0, 0.05, 1, 2.5, 100]) {
      const generated = createPopulation(tag.id, scale);
      assert.deepEqual(generated, createPopulation(tag.id, scale));
      assert.equal(generated.features.reduce((s, f) => s + f.properties.people, 0), peopleCount(tag.id, scale));
      assert.ok(generated.features.length <= 7 * 36);
      assert.ok(generated.features.every(f =>
        f.geometry.coordinates.every(Number.isFinite) &&
        Math.abs(f.geometry.coordinates[1]) <= 85
      ));
    }
  }
});

test('No synthetic activity at population 0', () => {
  for (const tag of TAGS) assert.equal(createPopulation(tag.id, 0).features.length, 0);
});

test('Neutral city lights do not count as people activity', () => {
  const neutral = neutralLightPoints();
  assert.ok(neutral.features.length > 0);
  assert.ok(neutral.features.every(x => x.properties.people === 1));
});

test('Density weight depends only on distinct people, not credited seconds', () => {
  assert.equal(peopleDensityWeight(0), 0);
  assert.ok(peopleDensityWeight(100) > peopleDensityWeight(1));
  assert.ok(peopleDensityWeight(1_000_000) <= 2.2);
  assert.equal(peopleDensityWeight(-1), 0);
  assert.equal(peopleDensityWeight(Number.NaN), 0);
});

test('Heatmap transitions away smoothly at detailed zoom', () => {
  assert.equal(heatVisibility(0), 0.88);
  assert.equal(heatVisibility(11.5), 0);
  assert.equal(heatVisibility(12), 0);
  assert.ok(heatVisibility(8) < heatVisibility(5));
  assert.ok(heatVisibility(10) < heatVisibility(8));
});
