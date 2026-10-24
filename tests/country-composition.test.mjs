import test from 'node:test';
import assert from 'node:assert/strict';
import {composeCountries,countryPattern,countryTagPage,OTHER_TAG_COLOR} from '../src/countryComposition.ts';
const tag=(id,n,countryCode='PT')=>({id:String(id).padStart(3,'0'),name:'#tag'+id,color:['#ff7755','#33ccff','#77dd55','#dd55cc'][Number(id)%4],activeParticipants:String(n),countries:[{countryCode,activeParticipants:String(n)}]});
const snapshot=tags=>({type:'country_snapshot',asOfMs:0,validUntilMs:5000,granularity:'country',privacyThreshold:5,tags});
test('empty, unknown and suppressed origins never acquire geometry',()=>{
  assert.deepEqual(composeCountries(null),[]);
  assert.deepEqual(composeCountries(snapshot([tag(0,8,'ZZ'),tag(1,8,'OTHER')])),[]);
  assert.throws(()=>composeCountries(snapshot([tag(0,4)])),/unsuppressed/);
});
test('one cohort uses its own color and stable 64x64 opaque bytes',()=>{
  const plan=composeCountries(snapshot([tag(0,8000000000n)]))[0];
  assert.equal(plan.participants,'8000000000');assert.equal(plan.shares[0].slots,32);
  const image=countryPattern(plan);assert.equal(image.data.length,64*64*4);
  for(let i=0;i<image.data.length;i+=4)assert.deepEqual([...image.data.slice(i,i+4)],[255,119,85,255]);
});
test('two equal cohorts split slots evenly; input order cannot alter output',()=>{
  const tags=[tag(0,4000000000n),tag(1,4000000000n)];
  const plans=composeCountries(snapshot(tags));assert.deepEqual(plans[0].shares.map(row=>row.slots),[16,16]);
  assert.deepEqual(composeCountries(snapshot([...tags].reverse())),plans);
});
test('top four plus neutral retain exact totals and all minority rows remain discoverable',()=>{
  for(const size of [13,17,100]){
    const data=snapshot(Array.from({length:size},(_,i)=>tag(i,5)));
    const plan=composeCountries(data)[0];assert.equal(plan.participants,String(size*5));
    assert.equal(plan.shares.length,4);assert.equal(plan.otherParticipants,String((size-4)*5));
    assert.equal(plan.palette.length,32);assert.ok(plan.palette.includes(OTHER_TAG_COLOR));
    assert.equal(countryTagPage(data,'PT','',0).total,size);
    assert.equal(composeCountries(data,data.tags.at(-1).id)[0].shares[0].slots,32);
  }
});
test('huge counts stay exact and quantization error is less than one slot',()=>{
  const values=[1000000000000n,8000000000n,900719925474099312345n,5n];
  const data=snapshot(values.map((n,i)=>tag(i,n))),plan=composeCountries(data)[0];
  const total=values.reduce((a,b)=>a+b,0n);assert.equal(plan.participants,String(total));
  for(const share of plan.shares){
    const error=BigInt(share.slots)*total-BigInt(share.participants)*32n;
    assert.ok((error<0n?-error:error)<total);
  }
  assert.equal(plan.shares.find(row=>row.id==='003').slots,0);
  assert.equal(countryTagPage(data,'PT','#tag3',0).rows[0].participants,'5');
});
test('search, paging and country filtering expose all rows with at most twenty entries',()=>{
  const data=snapshot(Array.from({length:53},(_,i)=>tag(i,i+5,i===52?'BR':'PT')));
  const seen=new Set();for(let page=0;page<3;page++){
    const result=countryTagPage(data,null,'',page);assert.ok(result.rows.length<=20);
    result.rows.forEach(row=>seen.add(row.id));
  }
  assert.equal(seen.size,53);assert.equal(countryTagPage(data,'BR','',99).page,0);
  assert.equal(countryTagPage(data,'PT','',0).total,52);
  assert.equal(countryTagPage(data,'BR',' ＃TAG52 ',0).rows[0].name,'#tag52');
  assert.equal(countryTagPage(data,'PT','#tag52',0).total,0);
});
test('duplicate identities cannot silently inflate a country',()=>{
  assert.throws(()=>composeCountries(snapshot([tag(0,5),tag(0,5)])),/duplicate_country_tag/);
});
