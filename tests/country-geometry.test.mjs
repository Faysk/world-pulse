import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeCountry} from '../server/countryCodes.mjs';

test('Pinned country asset contains only country polygons, never population or person coordinates',async()=>{
  const collection=JSON.parse(await readFile(new URL('../src/assets/countries-110m.geojson',import.meta.url),'utf8'));
  assert.equal(collection.type,'FeatureCollection');assert.equal(collection.features.length,174);
  const codes=new Set();
  for(const feature of collection.features){
    assert.deepEqual(Object.keys(feature.properties).sort(),['countryCode','name']);
    const code=feature.properties.countryCode;
    assert.equal(normalizeCountry(code),code);assert.equal(codes.has(code),false);codes.add(code);
    assert.ok(['Polygon','MultiPolygon'].includes(feature.geometry.type));
  }
  assert.ok(codes.has('PT'));assert.ok(codes.has('BR'));
  assert.ok(!codes.has('ZZ'));
});
