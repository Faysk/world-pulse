import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RELEASE_REGIONS, RELEASE_WINDOWS, firstUnlock, lastUnlock,
  isReleased, releasedWindows, revealProgress, nextUnlock, remainingText,
} from '../src/gta6LaunchSchedule.ts';
import { clipCountryReveal, splitCountryByZones } from '../src/gta6LaunchGeometry.ts';

const atlas = JSON.parse(readFileSync(new URL('../src/assets/countries-110m.geojson', import.meta.url), 'utf8'));

test('Every mapped inhabited country has a civil-time schedule, not merely the original 22', () => {
  const countryCodes = atlas.features.map(f => f.properties.countryCode)
    .filter(code => code !== 'AQ' && code !== 'TF').sort();
  assert.equal(countryCodes.length, 172);
  assert.deepEqual(RELEASE_REGIONS.map(r => r.code).sort(), countryCodes);
  assert.equal(RELEASE_WINDOWS.length, 211);
  assert.ok(RELEASE_REGIONS.every(r => r.windows.length >= 1));
  assert.ok(RELEASE_REGIONS.some(r => r.code === 'US' && r.windows.length > 1));
  assert.ok(RELEASE_REGIONS.some(r => r.code === 'BR' && r.windows.length > 1));
  assert.ok(RELEASE_REGIONS.some(r => r.code === 'RU' && r.windows.length > 1));
});

test('Each civil-time window corresponds to 19 November 2026 at 00:00 in the IANA timezone', () => {
  for (const region of RELEASE_REGIONS) {
    for (const window of region.windows) {
      const local = new Intl.DateTimeFormat('en-GB', {
        timeZone: window.timeZone, year: 'numeric', month: '2-digit',
        day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).format(new Date(window.unlockAt));
      assert.match(local, /19\/11\/2026, 00:00/, region.code + '/' + window.timeZone + ': ' + local);
    }
  }
});

test('Chronological global wave includes full Americas and stays monotonic', () => {
  assert.equal(firstUnlock, Date.parse('2026-11-18T11:00:00Z'));
  assert.equal(lastUnlock, Date.parse('2026-11-19T10:00:00Z'));
  assert.equal(nextUnlock(firstUnlock - 1000)?.region.code, 'NZ');
  assert.equal(nextUnlock(lastUnlock), undefined);
  assert.equal(remainingText(0), '00:00:00');
  assert.equal(remainingText(90_000), '00:01:30');
  const windows = RELEASE_WINDOWS.map(item => Date.parse(item.window.unlockAt));
  assert.deepEqual(windows, [...windows].sort((a,b) => a-b));
});

test('Country only completes when its last local midnight arrives', () => {
  const brazil = RELEASE_REGIONS.find(r => r.code === 'BR');
  assert.ok(brazil);
  const first = Date.parse(brazil.windows[0].unlockAt);
  const last = Date.parse(brazil.windows.at(-1).unlockAt);
  assert.equal(isReleased(brazil, first), false);
  assert.ok(releasedWindows(brazil, first) > 0);
  assert.equal(isReleased(brazil, last), true);
  assert.equal(releasedWindows(brazil, last), brazil.windows.length);
  assert.equal(revealProgress(brazil.windows[0], first - 1, false), 0);
  assert.ok(revealProgress(brazil.windows[0], first + 1800, false) > 0.5);
  assert.equal(revealProgress(brazil.windows[0], first + 3600, false), 1);
  assert.ok(revealProgress(brazil.windows[0], first + 3600, true) < 1);
});

test('Radial wave is confined inside its country polygon', () => {
  const square = { type: 'Polygon', coordinates: [[
    [0, 0], [4, 0], [4, 4], [0, 4], [0, 0]
  ]] };
  assert.equal(clipCountryReveal(square, [2, 2], 0), null);
  const partial = clipCountryReveal(square, [2, 2], 0.35);
  assert.ok(partial && partial.type === 'MultiPolygon');
  for (const polygon of partial.coordinates)
    for (const ring of polygon)
      for (const [x,y] of ring) {
        assert.ok(x >= -1e-5 && x <= 4 + 1e-5);
        assert.ok(y >= -1e-5 && y <= 4 + 1e-5);
      }
  assert.equal(clipCountryReveal(square, [2, 2], 1), square);
});

test('Multi-timezone split partitions a country without gaps or offshore spill', () => {
  const square = { type: 'Polygon', coordinates: [[
    [0, 0], [10, 0], [10, 10], [0, 10], [0, 0]
  ]] };
  const [west,east] = splitCountryByZones(square, [
    { anchor: [2, 5] }, { anchor: [8, 5] }
  ]);
  assert.ok(west && east && west.type === 'MultiPolygon' && east.type === 'MultiPolygon');
  for (const [geometry, low, high] of [[west,0,5],[east,5,10]]) {
    for (const polygon of geometry.coordinates)
      for (const ring of polygon)
        for (const [x,y] of ring) {
          assert.ok(x >= low - 1e-5 && x <= high + 1e-5);
          assert.ok(y >= -1e-5 && y <= 10 + 1e-5);
        }
  }
});

test('Every atlas country produces a real drawable segment', () => {
  const byCode = new Map(RELEASE_REGIONS.map(r => [r.code,r]));
  for (const feature of atlas.features) {
    const region = byCode.get(feature.properties.countryCode);
    if (!region) continue;
    const segments = splitCountryByZones(feature.geometry, region.windows);
    assert.equal(segments.length,region.windows.length,region.code);
    assert.ok(segments.some(segment => segment !== null),region.code);
    assert.ok(segments.every(segment => !segment || segment.type === 'Polygon' || segment.type === 'MultiPolygon'),region.code);
  }
});
