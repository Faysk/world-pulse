import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RELEASE_REGIONS, firstUnlock, lastUnlock,
  isReleased, revealProgress, nextUnlock, remainingText,
} from '../src/gta6LaunchSchedule.ts';
import { clipCountryReveal } from '../src/gta6LaunchGeometry.ts';

test('regional midnight schedule maps to 19 November 2026 in each reference store zone', () => {
  const codes = RELEASE_REGIONS.map(r => r.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const region of RELEASE_REGIONS) {
    const local = new Intl.DateTimeFormat('en-GB', {
      timeZone: region.timeZone, year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(new Date(region.unlockAt));
    assert.match(local, /19\/11\/2026, 00:00/, region.code + ' was not local midnight: ' + local);
  }
});

test('start/end and countdown are monotonic UTC instants', () => {
  assert.equal(firstUnlock, Date.parse('2026-11-18T11:00:00Z'));
  assert.equal(lastUnlock, Date.parse('2026-11-19T06:00:00Z'));
  assert.equal(nextUnlock(firstUnlock - 1000)?.code, 'NZ');
  assert.equal(nextUnlock(lastUnlock), undefined);
  assert.equal(remainingText(0), 'LIBERADO');
  assert.equal(remainingText(90_000), '00:01:30');
});

test('unlocked state, reveal progress and easing are deterministic', () => {
  const portugal = RELEASE_REGIONS.find(x => x.code === 'PT');
  assert.ok(portugal);
  const unlock = Date.parse(portugal.unlockAt);
  assert.equal(isReleased(portugal, unlock - 1), false);
  assert.equal(isReleased(portugal, unlock), true);
  assert.equal(revealProgress(portugal, unlock - 1, false), 0);
  assert.equal(revealProgress(portugal, unlock, false), 0);
  assert.ok(revealProgress(portugal, unlock + 1800, false) > 0.5);
  assert.equal(revealProgress(portugal, unlock + 3600, false), 1);
  assert.equal(revealProgress(portugal, unlock + 3600, true) < 1, true);
});

test('radial growth stays inside the source country boundary', () => {
  const square = { type: 'Polygon', coordinates: [[
    [0, 0], [4, 0], [4, 4], [0, 4], [0, 0]
  ]] };
  assert.equal(clipCountryReveal(square, [2, 2], 0), null);
  const partial = clipCountryReveal(square, [2, 2], 0.35);
  assert.ok(partial && partial.type === 'MultiPolygon');
  for (const poly of partial.coordinates) {
    for (const ring of poly) {
      for (const [x, y] of ring) {
        assert.ok(x >= -1e-5 && x <= 4 + 1e-5);
        assert.ok(y >= -1e-5 && y <= 4 + 1e-5);
      }
    }
  }
  assert.equal(clipCountryReveal(square, [2, 2], 1), square);
});

test('country shapes with no intersection do not create synthetic regions', () => {
  const square = { type: 'Polygon', coordinates: [[
    [12, 12], [13, 12], [13, 13], [12, 13], [12, 12]
  ]] };
  assert.equal(clipCountryReveal(square, [0, 0], 0.01), null);
});
