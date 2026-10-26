import {test} from 'node:test';
import assert from 'node:assert/strict';
import {countryLanguage,languages} from '../src/liveCopy.ts';
test('regional language uses supported country mappings and English without a known country',()=>{
  for(const country of ['PT','BR','AO'])assert.equal(countryLanguage(country),'pt');
  for(const country of ['ES','MX','AR'])assert.equal(countryLanguage(country),'es');
  for(const country of ['ZZ','','US','JP','DE'])assert.equal(countryLanguage(country),'en');
  const keys=Object.keys(languages.en).sort();
  for(const copy of Object.values(languages)){
    assert.deepEqual(Object.keys(copy).sort(),keys);
    for(const value of Object.values(copy))assert.ok(value.trim().length>0);
  }
});
