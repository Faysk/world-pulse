import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RELEASE_REGIONS, RELEASE_WINDOWS, VERIFIED_COUNTRY_CODES,
  UNCONFIRMED_COUNTRY_CODES, firstUnlock, lastUnlock,
  isReleased, releasedWindows, revealProgress, nextUnlock, remainingText,
} from '../src/gta6LaunchSchedule.ts';
import { clipCountryReveal, splitCountryByZones } from '../src/gta6LaunchGeometry.ts';
import { EXACT_STORE_UNLOCKS, PLAYSTATION_SUPPORTED_SET } from '../src/gta6MarketSources.ts';

const atlas = JSON.parse(readFileSync(new URL('../src/assets/countries-110m.geojson', import.meta.url), 'utf8'));

test('Only published PlayStation launch markets are in the release wave', () => {
  const mappedCodes = atlas.features.map(feature => feature.properties.countryCode)
    .filter(code => PLAYSTATION_SUPPORTED_SET.has(code)).sort();
  assert.equal(RELEASE_REGIONS.length,62);
  assert.deepEqual(RELEASE_REGIONS.filter(region => mappedCodes.includes(region.code))
    .map(region => region.code).sort(),mappedCodes);
  assert.equal(RELEASE_WINDOWS.length,RELEASE_REGIONS.length);
  assert.deepEqual(UNCONFIRMED_COUNTRY_CODES,['RU','KP']);
  assert.ok(!RELEASE_REGIONS.some(region => region.code === 'RU'));
  assert.ok(!RELEASE_REGIONS.some(region => region.code === 'KP'));
  assert.ok(RELEASE_REGIONS.some(region => region.code === 'KR'));
});

test('Direct PlayStation Store dates are distinct from Rockstar local-midnight policy-derived dates', () => {
  assert.deepEqual(VERIFIED_COUNTRY_CODES,Object.keys(EXACT_STORE_UNLOCKS).sort());
  for(const region of RELEASE_REGIONS) {
    const direct=EXACT_STORE_UNLOCKS[region.code];
    assert.equal(region.windows.length,1);
    assert.equal(region.verified,Boolean(direct),region.code);
    assert.equal(region.reference,!direct,region.code);
    if(direct){
      assert.equal(Date.parse(region.unlockAt),Date.parse(direct.unlockAt),region.code);
      assert.equal(region.storeUrl,direct.url);
    } else {
      assert.equal(region.storeUrl,undefined);
    }
  }
});

test('Each storefront market is a SINGLE release instant independent of civil time zones inside its country', () => {
  const byCode=new Map(RELEASE_REGIONS.map(region=>[region.code,region]));
  for(const code of ['US','CA','BR','PT','AU','MX','ID']) {
    const region=byCode.get(code);
    assert.ok(region);
    assert.equal(region.windows.length,1,code);
    assert.equal(releasedWindows(region,Date.parse(region.unlockAt)-1),0);
    assert.equal(isReleased(region,Date.parse(region.unlockAt)-1),false);
    assert.equal(isReleased(region,Date.parse(region.unlockAt)),true);
  }
});

test('Representative unverified zone has local midnight but does not become a verified store', () => {
  for(const region of RELEASE_REGIONS.filter(r=>!r.verified)) {
    const local=new Intl.DateTimeFormat('en-GB',{
      timeZone:region.timeZone,year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',hourCycle:'h23'
    }).format(new Date(region.unlockAt));
    assert.match(local,/19\/11\/2026, 00:00/,region.code+'/'+region.timeZone);
    assert.equal(region.verified,false);
  }
});

test('Countdown monotonicity and transition duration', () => {
  assert.ok(firstUnlock<=Date.parse('2026-11-18T11:00:00Z'));
  assert.ok(lastUnlock>=Date.parse('2026-11-19T05:00:00Z'));
  assert.equal(nextUnlock(lastUnlock),undefined);
  assert.equal(remainingText(0),'00:00:00');
  assert.equal(remainingText(90_000),'00:01:30');
  const instants=RELEASE_WINDOWS.map(x=>Date.parse(x.window.unlockAt));
  assert.deepEqual(instants,[...instants].sort((a,b)=>a-b));
  const brazil=RELEASE_REGIONS.find(r=>r.code==='BR');
  assert.ok(brazil);
  const start=Date.parse(brazil.unlockAt);
  assert.equal(revealProgress(brazil.windows[0],start-1,false),0);
  assert.ok(revealProgress(brazil.windows[0],start+1800,false)>0.2);
  assert.equal(revealProgress(brazil.windows[0],start+5500,false),1);
  assert.ok(revealProgress(brazil.windows[0],start+3600,true)<1);
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
