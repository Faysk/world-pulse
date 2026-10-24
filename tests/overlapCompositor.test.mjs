import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenarioPopulation } from '../src/demoData.ts';
import { aggregateForZoom, describeOverlaps } from '../src/spatialAggregation.ts';
import {
  buildCellPalette, samplePalette, MAX_WEBGL_SECTORS, MIN_VISUAL_SECTOR_SHARE
} from '../src/overlapCompositor.ts';

const A = {tag:'alpha',color:'#ff6728',people:100};
const B = {tag:'beta',color:'#28b5ff',people:50};
const C = {tag:'gamma',color:'#bd58ff',people:1};

test('One-pass palette is deterministic regardless of hashtag layer order',()=>{
  const first=buildCellPalette('coarse/6/17/24',[A,B,C]);
  for(const entries of [[C,A,B],[B,C,A],[A,B,C]]) {
    assert.deepEqual(buildCellPalette('coarse/6/17/24',entries),first);
  }
  assert.deepEqual(first.sectors.map(s=>s.tag),['alpha','beta','gamma']);
  assert.equal(first.totalPeople,151);
  assert.equal(first.sectors.at(-1).to,1);
  assert.ok(first.sectors.every(s=>s.to>s.from));
});

test('Exact per-hashtag counts retained while visible arcs never average pigments',()=>{
  const palette=buildCellPalette('coarse/6/17/24',[A,B,C]);
  assert.deepEqual(palette.sectors.map(s=>s.people),[100,50,1]);
  for (let i=0;i<palette.sectors.length;i++) {
    const sector=palette.sectors[i];
    const angle=((sector.from+sector.to)/2-palette.offset-.5)*2*Math.PI;
    const sample=samplePalette(palette,.5+.2*Math.cos(angle),.5+.2*Math.sin(angle));
    assert.equal(sample.tag,sector.tag);
    assert.equal(sample.color,sector.color);
    assert.ok(sample.alpha>0);
    assert.ok(sector.to-sector.from >= MIN_VISUAL_SECTOR_SHARE-1e-10);
  }
});

test('Clicks and credited seconds do not exist in or influence palette inputs',()=>{
  const first=buildCellPalette('coarse/6/17/24',[A,B,C]);
  const second=buildCellPalette('coarse/6/17/24',[{...A,clicks:1_000_000,seconds:9_000_000},B,C]);
  assert.deepEqual(first,second);
  const people=buildCellPalette('coarse/6/17/24',[{...A,people:10000},B,C]);
  assert.ok(people.glow>first.glow);
  assert.notEqual(people.sectors[0].to,first.sectors[0].to);
});

test('Zero active participants produce completely transparent output',()=>{
  const p=buildCellPalette('coarse/1/1/1',[{...A,people:0}]);
  assert.equal(p.totalPeople,0);
  assert.deepEqual(p.sectors,[]);
  assert.equal(p.glow,0);
  assert.deepEqual(samplePalette(p,.5,.5),{tag:null,color:null,alpha:0});
});

test('More than supported competing hashtags fail instead of erasing them',()=>{
  const inputs=Array.from({length:MAX_WEBGL_SECTORS+1},(_,i)=>({
    tag:'tag'+i,color:'#ff6728',people:i+1
  }));
  assert.throws(()=>buildCellPalette('region',inputs),/too many|more hashtags/i);
});

test('Duplicate tag aggregate rows are added once, conflicting colors rejected',()=>{
  const p=buildCellPalette('region',[A,{...A,people:15},B]);
  assert.equal(p.totalPeople,165);
  assert.equal(p.sectors.find(s=>s.tag==='alpha').people,115);
  assert.throws(()=>buildCellPalette('region',[A,{...A,color:'#123456'}]),/conflicting/i);
});

test('Invalid counts, malformed colors, white and unsafe arithmetic rejected',()=>{
  for(const entry of [
    {...A,people:-1},{...A,people:NaN},{...A,people:3.5},
    {...A,color:'blue'},{...A,color:'#ffffff'},{...A,tag:''}
  ]) assert.throws(()=>buildCellPalette('region',[entry]),RangeError);
  assert.throws(()=>buildCellPalette('region',[{...A,people:Number.MAX_SAFE_INTEGER},B]),/unsafe/i);
  assert.throws(()=>samplePalette(buildCellPalette('region',[A]),NaN,.5),RangeError);
});

test('One trillion synthetically represented participants conserve counts per cell',()=>{
  for(const distribution of ['concentrated','distributed']) {
    const source=createScenarioPopulation(1_000_000_000_000,distribution);
    const grouped=aggregateForZoom(source,{zoom:4,maxCells:125});
    const cells=describeOverlaps(grouped);
    for(const cell of cells) {
      const p=buildCellPalette('cell/'+cell.lng+'/'+cell.lat,cell.participants.map(e=>({
        tag:e.tag,color:e.color,people:e.people
      })));
      assert.equal(p.totalPeople,cell.totalPeople);
      assert.deepEqual(p.sectors.map(s=>s.tag),[...p.sectors.map(s=>s.tag)].sort());
      assert.ok(p.glow>0);
    }
    assert.equal(grouped.totalPeople,1_000_000_000_000);
  }
});

test('Raster samples are insensitive to list order for dense cells',()=>{
  const palette=buildCellPalette('tile/6/12/7',[C,B,A]);
  const reversed=buildCellPalette('tile/6/12/7',[A,B,C]);
  for(let row=0;row<10;row++)for(let col=0;col<10;col++) {
    const uv=[(col+.5)/10,(row+.5)/10];
    assert.deepEqual(samplePalette(palette,...uv),samplePalette(reversed,...uv));
  }
});
