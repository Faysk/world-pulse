import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYSTATION_SUPPORTED_CODES, PLAYSTATION_SUPPORTED_SET, EXACT_STORE_UNLOCKS,
  ROCKSTAR_MARKETS_URL } from '../src/gta6MarketSources.ts';
import { gta6TestSeconds, isGta6MomentUrl } from '../src/gta6TestMode.ts';
import { RELEASE_REGIONS, RELEASE_COUNTRIES, RELEASE_WINDOWS,
  VERIFIED_COUNTRY_CODES, UNCONFIRMED_COUNTRY_CODES, missingSupportedCodes,
  firstUnlock,lastUnlock,previewStart,previewEnd,
  nextMarkets,lastReleasedMarkets,launchTimeline,revealProgress, midnightOnLaunchDate, formatReleaseHeadline } from '../src/gta6LaunchSchedule.ts';

test('Rockstar-announced storefront coverage is complete and no unrelated countries unlock',()=>{
  assert.equal(PLAYSTATION_SUPPORTED_CODES.length,62);
  assert.equal(new Set(PLAYSTATION_SUPPORTED_CODES).size,62);
  assert.deepEqual(missingSupportedCodes,[]);
  assert.equal(RELEASE_REGIONS.length,62);
  assert.equal(RELEASE_WINDOWS.length,62);
  assert.deepEqual(RELEASE_COUNTRIES.map(x=>x.code).sort(),
    [...PLAYSTATION_SUPPORTED_CODES].sort());
  for (const code of ['RU','KP','CN','NG','QA']) {
    assert.equal(PLAYSTATION_SUPPORTED_SET.has(code),false);
    assert.equal(RELEASE_REGIONS.some(x=>x.code===code),false);
  }
  assert.deepEqual(UNCONFIRMED_COUNTRY_CODES,['RU','KP']);
  assert.ok(ROCKSTAR_MARKETS_URL.includes('rockstargames.com'));
});

test('Rockstar real store times override representative civil timezone midnight',()=>{
  const expected={
    NZ:'2026-11-18T11:00:00Z',AU:'2026-11-18T13:00:00Z',
    JP:'2026-11-18T15:00:00Z',KR:'2026-11-18T15:00:00Z',
    HK:'2026-11-18T16:00:00Z',SG:'2026-11-18T16:00:00Z',
    ID:'2026-11-18T17:00:00Z',
    PT:'2026-11-19T00:00:00Z',BR:'2026-11-19T03:00:00Z',
    US:'2026-11-19T05:00:00Z',CA:'2026-11-19T05:00:00Z'
  };
  for(const [code,utc] of Object.entries(expected)){
    const r=RELEASE_REGIONS.find(x=>x.code===code);
    assert.ok(r,code);
    assert.equal(Date.parse(r.unlockAt),Date.parse(utc));
    assert.equal(r.verified,true);
    assert.equal(r.storeUrl,EXACT_STORE_UNLOCKS[code].url);
  }
  assert.deepEqual(VERIFIED_COUNTRY_CODES.sort(),Object.keys(EXACT_STORE_UNLOCKS).sort());
});

test('Other announced markets use official local midnight rule, not invented storefront timestamps',()=>{
  for(const market of RELEASE_REGIONS.filter(x=>!x.verified)){
    assert.equal(market.reference,true);
    assert.equal(market.storeUrl,undefined);
    assert.equal(market.unlockAt,midnightOnLaunchDate(market.timeZone));
  }
});

test('Next 3 and last released 3 follow real timestamp ordering',()=>{
  const early=Date.parse('2026-11-18T10:00:00Z');
  const soon=nextMarkets(early,3);
  assert.equal(soon.length,3);
  assert.equal(soon[0].code,'NZ');
  assert.equal(soon[1].code,'AU');
  assert.deepEqual(lastReleasedMarkets(early,3),[]);
  const afterAussie=Date.parse('2026-11-18T14:00:00Z');
  assert.deepEqual(lastReleasedMarkets(afterAussie,3).map(x=>x.code),['AU','NZ']);
  const end=lastUnlock+1;
  assert.equal(nextMarkets(end).length,0);
  assert.equal(lastReleasedMarkets(end,3).length,3);
  assert.ok(firstUnlock<lastUnlock && previewStart<firstUnlock && previewEnd>lastUnlock);
  const timeline=RELEASE_COUNTRIES.map(x=>Date.parse(x.unlockAt));
  assert.deepEqual(timeline,[...timeline].sort((a,b)=>a-b));
});

test('Primary headline always advances to the earliest unfulfilled market',()=>{
  const before=launchTimeline(Date.parse('2026-11-18T10:00:00Z'));
  assert.equal(before.headline?.code,'NZ');
  assert.deepEqual(before.upcoming.map(x=>x.code).slice(0,1),['AU']);
  assert.equal(before.upcoming.length,3);
  assert.ok(!before.upcoming.some(x=>x.code===before.headline?.code));
  assert.equal(before.recent.length,0);

  const exactly=launchTimeline(Date.parse('2026-11-18T11:00:00Z'));
  assert.equal(exactly.headline?.code,'AU');
  assert.equal(exactly.recent[0]?.code,'NZ');
  assert.ok(!exactly.upcoming.some(x=>x.code===exactly.headline?.code));

  const afterAu=launchTimeline(Date.parse('2026-11-18T14:00:00Z'));
  assert.equal(afterAu.headline?.code,'KR');
  assert.deepEqual(afterAu.recent.map(x=>x.code),['AU','NZ']);

  const completed=launchTimeline(lastUnlock+1);
  assert.equal(completed.headline,null);
  assert.equal(completed.upcoming.length,0);
  assert.equal(completed.recent.length,3);
});

test('Headline date is stable across native pt-PT Intl implementations',()=>{
  // Browser ICU may use 19/11 instead of a Portuguese month abbreviation.
  // The UI deliberately uses an explicit short month label.
  for (const code of ['NZ','AU','PT','BR','US']) {
    const market=RELEASE_REGIONS.find(m=>m.code===code);
    assert.ok(market,code);
    assert.equal(formatReleaseHeadline(market.windows[0]),'19 NOV · 00:00',code);
  }
});

test('Replay parser allows 1 to 3600 seconds only and handles user shorthand',()=>{
  const cases={
    '?moment=gta6':null,
    '?moment=gta6&simular=1':1,
    '?moment=gta6&simular=45':45,
    '?moment=gta6&simular45':45,
    '?moment=gta6%simular45':45,
    '?moment=gta6&simular=3600':3600,
    '?moment=gta6&simular=0':null,
    '?moment=gta6&simular=3601':null,
    '?moment=gta6&simular=9999':null,
    '?moment=gta6&simular=2.5':null,
    '?moment=gta6&simular=-1':null,
    '?moment=gta6&simular=abc':null
  };
  for(const [url,value] of Object.entries(cases)){
    assert.equal(gta6TestSeconds(url),value,url);
    assert.equal(isGta6MomentUrl(url),true,url);
  }
  assert.equal(isGta6MomentUrl('?moment=nope'),false);
});

test('Real wave is smooth 5.5s; test wave scales to replay duration',()=>{
  const window=RELEASE_REGIONS.find(x=>x.code==='BR').windows[0];
  const start=Date.parse(window.unlockAt);
  assert.equal(revealProgress(window,start-1),0);
  assert.ok(revealProgress(window,start+1100)>0);
  assert.ok(revealProgress(window,start+1100)<0.5);
  assert.equal(revealProgress(window,start+5500),1);
  for(const secs of [1,45,300,3600]){
    const startFraction=revealProgress(window,start,true,secs);
    const future=revealProgress(window,start+6*3_600_000,true,secs);
    assert.equal(startFraction,0);
    assert.ok(future>0 && future<=1,secs+'s');
  }
});
