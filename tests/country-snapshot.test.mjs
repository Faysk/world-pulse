import test from 'node:test';
import assert from 'node:assert/strict';
import {countrySnapshot}from'../server/countrySnapshot.mjs';
import {countryEstimateForRequest}from'../server/geoPrivacy.mjs';
import {normalizeCountry}from'../server/countryCodes.mjs';
const id='11111111-1111-4111-8111-111111111111';
const row=(country,participants)=>({tag_id:id,normalized:'gta6',color:'#ffffff',country_code:country,participants});
test('country source fails closed, needs platform and two explicit operator attestations',()=>{
 const req={headers:{'x-vercel-ip-country':'PT','cf-ipcountry':'BR'}};
 assert.equal(countryEstimateForRequest(req,{}),'ZZ');
 assert.equal(countryEstimateForRequest(req,{VERCEL:'1',WP_GEO_COUNTRY_ENABLED:'true'}),'ZZ');
 assert.equal(countryEstimateForRequest(req,{VERCEL:'1',WP_GEO_COUNTRY_ENABLED:'true',WP_GEO_DIRECT_EDGE:'true'}),'PT');
 for(const code of ['AA','XX','OTHER','P1','PT,BR',null])assert.equal(normalizeCountry(code),'ZZ');
 assert.equal(normalizeCountry('tw'),'TW');assert.equal(normalizeCountry(' pt '),'PT');
});
test('country snapshot preserves bigint totals, suppresses small origins and never has individual IDs or points',()=>{
 const snapshot=countrySnapshot([row('PT','4'),row('BR','3'),row('US','9007199254740993'),row('ZZ','2')],10000);
 const tag=snapshot.tags[0];
 assert.equal(tag.activeParticipants,'9007199254741002');
 assert.deepEqual(tag.countries,[{countryCode:'OTHER',activeParticipants:'7'},{countryCode:'US',activeParticipants:'9007199254740993'},{countryCode:'ZZ',activeParticipants:'2'}]);
 assert.equal(snapshot.validUntilMs,15000);
 assert.ok(!/visitor|latitude|longitude|coordinates|session_hash|ip_address/.test(JSON.stringify(snapshot)));
 assert.deepEqual(countrySnapshot([],10000).tags,[]);
});
