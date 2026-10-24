import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  approximateCountryFromHeaders, suppressSmallCountryGroups,
  MIN_PUBLISHED_COUNTRY_GROUP
} from '../server/geoPrivacy.mjs';

const A=randomUUID(), B=randomUUID();
test('Untrusted metadata is never treated as visitor location', () => {
  const headers = { 'x-vercel-ip-country': 'PT', 'cf-ipcountry':'BR', 'x-vercel-ip-city':'Porto',
    'x-vercel-ip-latitude':'41.1456', 'x-vercel-ip-longitude':'-8.6164',
    'x-vercel-ip-postal-code':'4580-000' };
  const untrusted = approximateCountryFromHeaders(headers);
  assert.deepEqual(untrusted, {countryCode:'ZZ',source:'unverified',granularity:'unknown'});
  const viaProxy = approximateCountryFromHeaders(headers,{trustedEdge:true,proxyInFront:true});
  assert.equal(viaProxy.countryCode,'ZZ');
  assert.equal(approximateCountryFromHeaders(headers,{trustedEdge:true}).countryCode,'PT');
  const output=JSON.stringify(approximateCountryFromHeaders(headers,{trustedEdge:true}));
  for(const disallowed of ['Porto','41.1456','-8.6164','4580-000','cf-ipcountry','BR']){
    assert.equal(output.includes(disallowed),false);
  }
});

test('Country-only information never guesses a city or a finer location', () => {
  assert.deepEqual(approximateCountryFromHeaders({'x-vercel-ip-country':'br'},{trustedEdge:true}),{
    countryCode:'BR',source:'vercel-ip-estimate',granularity:'country'
  });
  for(const candidate of ['','XY1','PT/PT','  ','zz',null,42]) {
    assert.equal(approximateCountryFromHeaders({'x-vercel-ip-country':candidate},{trustedEdge:true}).countryCode,'ZZ');
  }
});

test('Small country cells merge into OTHER but preserve all exact counts', () => {
  const snapshot=suppressSmallCountryGroups([
    {tagId:A,countryCode:'PT',activeParticipants:4},
    {tagId:A,countryCode:'BR',activeParticipants:19},
    {tagId:A,countryCode:'DE',activeParticipants:1},
    {tagId:A,countryCode:'ZZ',activeParticipants:7},
    {tagId:B,countryCode:'BR',activeParticipants:5},
  ]);
  const a=snapshot.find(x=>x.tagId===A);
  assert.equal(a.totalActiveParticipants,31);
  assert.deepEqual(a.regions,[
    {countryCode:'BR',activeParticipants:19},
    {countryCode:'ZZ',activeParticipants:7},
    {countryCode:'OTHER',activeParticipants:5}
  ]);
  const b=snapshot.find(x=>x.tagId===B);
  assert.equal(b.totalActiveParticipants,5);
  assert.deepEqual(b.regions,[{countryCode:'BR',activeParticipants:5}]);
  assert.equal(JSON.stringify(snapshot).includes('city'),false);
  assert.equal(JSON.stringify(snapshot).includes('coordinates'),false);
});

test('Duplicate aggregate rows merge before applying threshold', () => {
  const output=suppressSmallCountryGroups([
    {tagId:A,countryCode:'PT',activeParticipants:3},
    {tagId:A,countryCode:'PT',activeParticipants:3}
  ]);
  assert.deepEqual(output[0].regions,[{countryCode:'PT',activeParticipants:6}]);
});

test('Unknown geography is not invented or mislabeled as OTHER', () => {
  const output=suppressSmallCountryGroups([
    {tagId:A,countryCode:'ZZ',activeParticipants:2},
    {tagId:A,countryCode:'PT',activeParticipants:1}
  ]);
  assert.deepEqual(output[0].regions,[
    {countryCode:'ZZ',activeParticipants:2},
    {countryCode:'OTHER',activeParticipants:1}
  ]);
  assert.equal(output[0].totalActiveParticipants,3);
});

test('Top 10 product rules do not imply revealing fine-grained tiny groups', () => {
  assert.equal(MIN_PUBLISHED_COUNTRY_GROUP,5);
  assert.throws(()=>suppressSmallCountryGroups([],1),RangeError);
  assert.throws(()=>suppressSmallCountryGroups([],4),RangeError);
  assert.ok(Array.isArray(suppressSmallCountryGroups([],5)));
  assert.throws(()=>suppressSmallCountryGroups([],0),RangeError);
});

test('Reject malformed counts, reserved buckets and overflow, never coerce', () => {
  for(const row of [
    {tagId:A,countryCode:'PT',activeParticipants:-1},
    {tagId:A,countryCode:'PT',activeParticipants:1.5},
    {tagId:A,countryCode:'PT',activeParticipants:'1'},
    {tagId:A,countryCode:'OTHER',activeParticipants:3},
    {tagId:'visitor@example.com',countryCode:'PT',activeParticipants:10},
    {tagId:A,countryCode:'P@',activeParticipants:2}
  ])assert.throws(()=>suppressSmallCountryGroups([row]),RangeError);
  assert.throws(()=>suppressSmallCountryGroups([
    {tagId:A,countryCode:'PT',activeParticipants:Number.MAX_SAFE_INTEGER},
    {tagId:A,countryCode:'PT',activeParticipants:1}
  ]),RangeError);
});

test('Results are deterministic after source aggregate rows are reordered', () => {
  const rows=[
    {tagId:A,countryCode:'PT',activeParticipants:100},
    {tagId:B,countryCode:'FR',activeParticipants:6},
    {tagId:A,countryCode:'BR',activeParticipants:1},
    {tagId:A,countryCode:'US',activeParticipants:2},
    {tagId:A,countryCode:'ZZ',activeParticipants:17}
  ];
  assert.deepEqual(suppressSmallCountryGroups(rows),suppressSmallCountryGroups([...rows].reverse()));
});
