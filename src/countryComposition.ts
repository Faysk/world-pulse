import type {CountrySnapshot} from './countryTypes';
export const COUNTRY_PATTERN_SIZE=64;
export const COUNTRY_PATTERN_SLOTS=32;
export const OTHER_TAG_COLOR='#8a98a6';
type Share={id:string;name:string;color:string;participants:string;slots:number};
export type CountryComposition={countryCode:string;participants:string;shares:Share[];otherParticipants:string;palette:string[];signature:string;outlineColor:string};
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
const count=(value:string)=>{if(!/^\d{1,64}$/.test(value))throw new Error('invalid_country_count');return BigInt(value);};

/** Country cohorts only. Unknown/suppressed origins never acquire geometry. */
export function composeCountries(snapshot:CountrySnapshot|null,focusTagId:string|null=null):CountryComposition[]{
  if(!snapshot)return [];
  const countries=new Map<string,Array<{id:string;name:string;color:string;value:bigint}>>();
  const ids=new Set<string>();
  for(const tag of snapshot.tags){
    if(ids.has(tag.id))throw new Error('duplicate_country_tag');ids.add(tag.id);
    if(focusTagId&&tag.id!==focusTagId)continue;
    if(!/^#[0-9a-f]{6}$/i.test(tag.color))throw new Error('invalid_country_color');
    const seen=new Set<string>();
    for(const row of tag.countries){
      if(seen.has(row.countryCode))throw new Error('duplicate_country_cohort');seen.add(row.countryCode);
      if(row.countryCode==='ZZ'||row.countryCode==='OTHER')continue;
      if(!/^[A-Z]{2}$/.test(row.countryCode))throw new Error('invalid_country_code');
      const value=count(row.activeParticipants);if(!value)continue;
      if(value<5n)throw new Error('unsuppressed_country_cohort');
      const list=countries.get(row.countryCode)??[];
      list.push({id:tag.id,name:tag.name,color:tag.color,value});countries.set(row.countryCode,list);
    }
  }
  return [...countries].sort(([a],[b])=>compare(a,b)).map(([countryCode,rows])=>{
    rows.sort((a,b)=>a.value>b.value?-1:a.value<b.value?1:compare(a.id,b.id));
    const total=rows.reduce((sum,row)=>sum+row.value,0n);
    const top=rows.slice(0,4),other=rows.slice(4).reduce((sum,row)=>sum+row.value,0n);
    const bins=[...top.map(row=>({id:row.id,color:row.color,value:row.value})),...(other?[{id:'~other',color:OTHER_TAG_COLOR,value:other}]:[])];
    const portions=bins.map(bin=>{const scaled=bin.value*BigInt(COUNTRY_PATTERN_SLOTS);return {...bin,slots:Number(scaled/total),remainder:scaled%total};});
    let left=COUNTRY_PATTERN_SLOTS-portions.reduce((sum,row)=>sum+row.slots,0);
    const order=[...portions].sort((a,b)=>a.remainder>b.remainder?-1:a.remainder<b.remainder?1:compare(a.id,b.id));
    for(const bin of order){if(!left)break;bin.slots++;left--;}
    const palette=portions.flatMap(bin=>Array<string>(bin.slots).fill(bin.color));
    return {countryCode,participants:String(total),shares:top.map((row,index)=>({id:row.id,name:row.name,color:row.color,participants:String(row.value),slots:portions[index].slots})),
      otherParticipants:String(other),palette,signature:palette.join(''),outlineColor:top[0].color};
  });
}

export function countryPattern(plan:CountryComposition){
  if(plan.palette.length!==COUNTRY_PATTERN_SLOTS)throw new Error('invalid_country_palette');
  const data=new Uint8Array(COUNTRY_PATTERN_SIZE*COUNTRY_PATTERN_SIZE*4);
  for(let y=0;y<COUNTRY_PATTERN_SIZE;y++)for(let x=0;x<COUNTRY_PATTERN_SIZE;x++){
    const color=plan.palette[Math.floor(((x+y)%COUNTRY_PATTERN_SIZE)/2)];
    const offset=(y*COUNTRY_PATTERN_SIZE+x)*4;
    for(let channel=0;channel<3;channel++)data[offset+channel]=parseInt(color.slice(1+channel*2,3+channel*2),16);
    data[offset+3]=255;
  }
  return {width:COUNTRY_PATTERN_SIZE,height:COUNTRY_PATTERN_SIZE,data};
}

export function countryTagPage(snapshot:CountrySnapshot|null,countryCode:string|null,query:string,page:number){
  const needle=query.normalize('NFKC').toLowerCase().trim();
  const rows=(snapshot?.tags??[]).flatMap(tag=>{
    const value=countryCode?tag.countries.find(row=>row.countryCode===countryCode)?.activeParticipants:tag.activeParticipants;
    return value&&count(value)>0n&&tag.name.toLowerCase().includes(needle)?[{id:tag.id,name:tag.name,color:tag.color,participants:value}]:[];
  }).sort((a,b)=>count(a.participants)>count(b.participants)?-1:count(a.participants)<count(b.participants)?1:compare(a.id,b.id));
  const pages=Math.max(1,Math.ceil(rows.length/20));
  const current=Math.max(0,Math.min(pages-1,Number.isFinite(page)?Math.floor(page):0));
  return {rows:rows.slice(current*20,current*20+20),total:rows.length,page:current,pages};
}
