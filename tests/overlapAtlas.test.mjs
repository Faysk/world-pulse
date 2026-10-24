import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenarioPopulation } from '../src/demoData.ts';
import { aggregateForZoom, describeOverlaps } from '../src/spatialAggregation.ts';
import {
  buildOverlapAtlas, pickAtlasSector, MAX_ATLAS_CELLS, ATLAS_TEXTURE_WIDTH
} from '../src/overlapAtlas.ts';

const a={tag:'gta6',color:'#ff6753',people:330};
const b={tag:'lofi',color:'#5dc8ee',people:180};
const c={tag:'minecraft',color:'#b67bff',people:45};
const make=(n)=>Array.from({length:n},(_,i)=>({
  cellKey:'tile/'+String(i).padStart(4,'0'),
  participants:[{...a,people:i+1},{...b,people:2*(i+1)}]
}));

test('Many coarse cells are sorted and packed into a single compact RGBA8 atlas',()=>{
  const cells=make(125);
  const atlas=buildOverlapAtlas(cells);
  assert.equal(atlas.cells.length,125);
  assert.equal(atlas.columns,12);
  assert.equal(atlas.rows,11);
  assert.equal(atlas.totalPeople,3*125*126/2);
  assert.equal(atlas.rgba.length,125*ATLAS_TEXTURE_WIDTH*4);
  assert.equal(atlas.cells.at(-1).cellKey,'tile/0124');
  assert.deepEqual(atlas.rgba.slice(0,3),[255,103,83]);
  assert.equal(atlas.rgba[(ATLAS_TEXTURE_WIDTH-1)*4+2],2);
});

test('Input cell order and hashtag order do not change texture bytes or click routing',()=>{
  const cells=[
    {cellKey:'region/B',participants:[b,c,a]},
    {cellKey:'region/A',participants:[c,a,b]}
  ];
  const p=buildOverlapAtlas(cells,2);
  const q=buildOverlapAtlas([...cells].reverse().map(c=>({
    ...c, participants:[...c.participants].reverse()
  })),2);
  assert.deepEqual(p,q);
  const first=p.cells[0];
  const sector=first.sectors.find(s=>s.tag==='lofi');
  assert.ok(sector);
  const angle=((sector.from+sector.to)/2-
    p.rgba[(MAX_ATLAS_CELLS?ATLAS_TEXTURE_WIDTH-1:12)*4+1]/255-.5)*Math.PI*2;
  const u=.25+.1*Math.cos(angle);
  const v=.5-.2*Math.sin(angle);
  assert.deepEqual(pickAtlasSector(p,u,v),pickAtlasSector(q,u,v));
  assert.equal(pickAtlasSector(p,u,v)?.tag,'lofi');
});

test('Every hashtag is selectable in the packed atlas despite RGBA8 stop quantization',()=>{
  const pal=buildOverlapAtlas([
    {cellKey:'A',participants:[a,b,c]},
    {cellKey:'B',participants:[{...a,people:999},{...b,people:1}]}
  ],2);
  for(let k=0;k<pal.cells.length;k++){
    const cell=pal.cells[k];
    const meta=(k*ATLAS_TEXTURE_WIDTH+12)*4;
    const offset=pal.rgba[meta+1]/255;
    for(const sector of cell.sectors){
      // Texture end angle is quantized, so choose the approximate MIDPOINT
      // and verify pick still resolves the minority sector correctly.
      const angle=((sector.from+sector.to)/2-offset-.5)*Math.PI*2;
      const u=(k+.5+.18*Math.cos(angle))/2;
      const v=.5-.18*Math.sin(angle);
      const hit=pickAtlasSector(pal,u,v);
      assert.equal(hit?.tag,sector.tag);
      assert.equal(hit?.people,sector.people);
      assert.equal(hit?.cellKey,cell.cellKey);
    }
  }
});

test('No click on unused grid slot or outside a cell circle produces a fake hashtag',()=>{
  const atlas=buildOverlapAtlas(make(5),3);
  assert.equal(atlas.rows,2);
  assert.equal(pickAtlasSector(atlas,.91,.9),null);
  assert.equal(pickAtlasSector(atlas,1,.1),null);
  assert.equal(pickAtlasSector(atlas,-.1,.3),null);
  assert.equal(pickAtlasSector(atlas,.1,.99),null);
  assert.equal(pickAtlasSector(atlas,NaN,.5),null);
});

test('Empty active participation uses zero geometry and zero draw payload',()=>{
  const empty=buildOverlapAtlas([]);
  assert.equal(empty.cells.length,0);
  assert.equal(empty.totalPeople,0);
  assert.equal(empty.rgba.length,52);
  const zero=buildOverlapAtlas([{cellKey:'empty',participants:[{...a,people:0}]}]);
  assert.equal(zero.totalPeople,0);
  assert.equal(zero.cells[0].sectors.length,0);
  assert.equal(pickAtlasSector(zero,.5,.5),null);
});

test('Strict cell and hashtag budget refuses implicit dropping',()=>{
  assert.throws(()=>buildOverlapAtlas(make(MAX_ATLAS_CELLS+1)),RangeError);
  assert.throws(()=>buildOverlapAtlas(make(3),33),RangeError);
  assert.throws(()=>buildOverlapAtlas(make(3),0),RangeError);
  assert.throws(()=>buildOverlapAtlas([...make(1),...make(1)]),RangeError);
  assert.throws(()=>buildOverlapAtlas([
    {cellKey:'crowded',participants:Array.from({length:13},(_,i)=>({...a,tag:'tag'+i}))}
  ]),RangeError);
});

test('Synthetic trillion preserves every participant across bounded aggregated atlas cells',()=>{
  for(const distribution of ['distributed','concentrated']){
    const geo=aggregateForZoom(createScenarioPopulation(1_000_000_000_000,distribution),{
      zoom:4,maxCells:125
    });
    // Build every underlying tagged tile, including tiles without overlap.
    const grouped=new Map();
    geo.population.features.forEach(f=>{
      const key=f.geometry.coordinates.join('/');
      const arr=grouped.get(key)??[];
      arr.push({tag:f.properties.tag,color:f.properties.color,people:f.properties.people});
      grouped.set(key,arr);
    });
    const atlas=buildOverlapAtlas([...grouped].map(([cellKey,participants])=>({cellKey,participants})));
    assert.equal(atlas.totalPeople,1_000_000_000_000);
    assert.equal(atlas.cells.reduce((n,p)=>n+p.totalPeople,0),1_000_000_000_000);
    assert.ok(atlas.cells.length<=125);
    for(const shared of describeOverlaps(geo)){
      const atlasCell=atlas.cells.find(x=>x.cellKey===shared.lng+'/'+shared.lat);
      assert.equal(atlasCell.totalPeople,shared.totalPeople);
    }
  }
});

test('No clicks/credited seconds can change the atlas glow or sector distribution',()=>{
  const before=buildOverlapAtlas([{cellKey:'A',participants:[a,b]}]);
  const after=buildOverlapAtlas([{cellKey:'A',participants:[
    {...a,clicks:1_000_000,seconds:3600000},{...b,clicks:1}
  ]}]);
  assert.deepEqual(before,after);
});
