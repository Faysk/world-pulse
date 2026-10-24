import test from 'node:test';
import assert from 'node:assert/strict';
import {
  projectCoarsePoint,planGeographicAtlas,pickGeographicAtlas,
  type GeoViewport
} from '../src/geographicAtlas.ts';
const viewport=(overrides={})=>({
  lng:0,lat:0,zoom:1,width:1200,height:720,cellZoom:5,...overrides
});
const a={tag:'gta6',color:'#ff6753',people:300};
const b={tag:'lofi',color:'#5dc8ee',people:1};
const make=(n)=>Array.from({length:n},(_,i)=>({
  cellKey:'cell-'+String(i).padStart(5,'0'),
  lng:(i*137.508%360)-180,
  lat:(i*47.3%140)-70,
  participants:[{...a,people:i+1},{...b,people:1}]
}));

test('Mercator projection centers viewport, wraps antimeridian and remains finite near poles',()=>{
  const v=viewport({lng:179.5,lat:0,zoom:5,width:1200,height:720});
  const atCenter=projectCoarsePoint(179.5,0,v);
  assert.ok(Math.abs(atCenter.x-600)<1e-8);
  assert.ok(Math.abs(atCenter.y-360)<1e-8);
  const east=projectCoarsePoint(-179.5,0,v);
  assert.ok(east.x>atCenter.x);
  assert.ok(east.x-atCenter.x<60, 'one degree at the dateline must be close');
  const west=projectCoarsePoint(178.5,0,v);
  assert.ok(west.x<atCenter.x);
  for(const lat of [-90,-85,0,85,90]){
    const p=projectCoarsePoint(179.5,lat,v);
    assert.ok(Number.isFinite(p.y));
  }
  assert.deepEqual(projectCoarsePoint(540,0,v),projectCoarsePoint(180,0,v));
});

test('Offscreen cells do not get rendered but global totals are preserved',()=>{
  const v=viewport({lng:0,lat:0,zoom:5,width:900,height:600,cellZoom:5});
  const cells=[
    {cellKey:'origin',lng:0,lat:0,participants:[a,b]},
    {cellKey:'other',lng:120,lat:0,participants:[{...a,people:900}]}
  ];
  const plan=planGeographicAtlas(cells,v);
  assert.equal(plan.totalPeople,1201);
  assert.equal(plan.visiblePeople,301);
  assert.equal(plan.visibleCells,1);
  assert.equal(plan.hiddenCells,1);
  assert.equal(plan.pages.length,1);
  assert.equal(plan.pages[0].atlas.cells[0].cellKey,'origin');
  const origin=projectCoarsePoint(0,0,v);
  assert.equal(pickGeographicAtlas(plan,origin.x,origin.y)?.cellKey,'origin');
  assert.equal(pickGeographicAtlas(plan,-100,0),null);
});

test('Color-sector pick matches quantized GPU atlas data, even minority hashtag',()=>{
  const v=viewport({zoom:6,cellZoom:7});
  const plan=planGeographicAtlas([
    {cellKey:'center',lng:0,lat:0,participants:[a,b]}
  ],v);
  const cell=plan.pages[0].atlas.cells[0],screen=plan.pages[0].screens[0];
  const rgba=plan.pages[0].atlas.rgba,offset=rgba[12*4+1]/255;
  for(const sector of cell.sectors) {
    const mid=(sector.from+sector.to)/2;
    const theta=(mid-offset-.5)*Math.PI*2;
    const x=screen.x+screen.radius*.5*Math.cos(theta);
    const y=screen.y-screen.radius*.5*Math.sin(theta);
    assert.deepEqual(pickGeographicAtlas(plan,x,y),{
      cellKey:'center',tag:sector.tag,color:sector.color,people:sector.people
    });
  }
});

test('More than 256 visible regional cells are paginated without dropping people',()=>{
  const cells=make(600);
  const plan=planGeographicAtlas(cells,viewport({zoom:0,width:1400,height:820,cellZoom:6}));
  assert.equal(plan.totalCells,600);
  assert.equal(plan.visibleCells,600);
  assert.equal(plan.hiddenCells,0);
  assert.equal(plan.pages.length,3);
  assert.deepEqual(plan.pages.map(p=>p.atlas.cells.length),[256,256,88]);
  assert.equal(plan.totalPeople,600*601/2+600);
  assert.equal(plan.visiblePeople,plan.totalPeople);
  const perPage=plan.pages.reduce((s,p)=>s+p.atlas.totalPeople,0);
  assert.equal(perPage,plan.totalPeople);
  assert.ok(plan.pages.every(p=>p.placements.length===p.atlas.cells.length*4));
});

test('Projection and sector picking remain deterministic after reversing input order',()=>{
  const cells=make(150),v=viewport({zoom:2,width:1600,height:900});
  const first=planGeographicAtlas(cells,v);
  const second=planGeographicAtlas([...cells].reverse(),v);
  assert.deepEqual(first,second);
  const p=first.pages[0]?.screens[0];
  if(p) assert.deepEqual(pickGeographicAtlas(first,p.x,p.y),
    pickGeographicAtlas(second,p.x,p.y));
});

test('Panning and zooming recalculate visibility but never silently discard the global total',()=>{
  const cells=make(600);
  const atWorld=planGeographicAtlas(cells,viewport({zoom:0,width:1400,height:820}));
  const atCity=planGeographicAtlas(cells,viewport({zoom:8,lng:-8.5,lat:41.2,width:1400,height:820}));
  assert.equal(atWorld.totalPeople,atCity.totalPeople);
  assert.ok(atCity.visibleCells<atWorld.visibleCells);
  assert.equal(atWorld.pages.reduce((sum,p)=>sum+p.atlas.totalPeople,0),atWorld.visiblePeople);
  assert.equal(atCity.pages.reduce((sum,p)=>sum+p.atlas.totalPeople,0),atCity.visiblePeople);
});

test('Empty input, offscreen viewport and idle state need zero GPU draws',()=>{
  const empty=planGeographicAtlas([],viewport());
  assert.equal(empty.totalPeople,0);
  assert.equal(empty.pages.length,0);
  assert.equal(empty.visibleCells,0);
  const offscreen=planGeographicAtlas([
    {cellKey:'far',lng:170,lat:0,participants:[a]}
  ],viewport({zoom:10}));
  assert.equal(offscreen.pages.length,0);
  assert.equal(offscreen.totalPeople,300);
  assert.equal(offscreen.visiblePeople,0);
});

test('Invalid coordinates and input budgets fail instead of masking people',()=>{
  const v=viewport();
  assert.throws(()=>projectCoarsePoint(0,NaN,v),RangeError);
  assert.throws(()=>planGeographicAtlas([{cellKey:'bad',lng:0,lat:91,participants:[a]}],v),RangeError);
  assert.throws(()=>planGeographicAtlas([
    {cellKey:'same',lng:0,lat:0,participants:[a]},
    {cellKey:'same',lng:1,lat:0,participants:[a]}
  ],v),RangeError);
  assert.throws(()=>planGeographicAtlas([{cellKey:'bad',lng:0,lat:0,participants:[{...a,people:-1}]}],v),RangeError);
  assert.throws(()=>planGeographicAtlas([],viewport({zoom:18})),RangeError);
  assert.throws(()=>planGeographicAtlas([],viewport({width:-1})),RangeError);
  assert.throws(()=>planGeographicAtlas([],viewport({cellZoom:20})),RangeError);
});

test('One-trillion synthetic active people conserve count during zoom-dependent culling',()=>{
  const cells=make(80);
  const total=1_000_000_000_000;
  const per=Math.floor(total/cells.length);
  cells.forEach((c,i)=>{c.participants=[{...a,people:per+(i===0?total-per*cells.length:0)}];});
  for(const zoom of [0,1,3,8]){
    const plan=planGeographicAtlas(cells,viewport({zoom,width:1400,height:820}));
    assert.equal(plan.totalPeople,total);
    assert.equal(plan.visiblePeople,plan.pages.reduce((sum,p)=>sum+p.atlas.totalPeople,0));
  }
});

test('Clicks and credited seconds cannot change country glow, geographic placement, or counts',()=>{
  const cells=[{cellKey:'a',lng:-8.5,lat:41.2,participants:[a,b]}];
  const edited=[{cellKey:'a',lng:-8.5,lat:41.2,participants:[
    {...a,clicks:900,seconds:1800},{...b,clicks:1000000}
  ]}];
  assert.deepEqual(planGeographicAtlas(cells,viewport()),planGeographicAtlas(edited,viewport()));
});
