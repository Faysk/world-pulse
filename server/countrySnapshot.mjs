import { normalizeCountry } from './countryCodes.mjs';

// All values are pre-aggregated; never accept visitor rows here.
export function countrySnapshot(rows,asOfMs) {
  const tags=new Map();
  for(const row of rows){
    const value=BigInt(row.participants);
    if(value<0n)throw new RangeError('negative_country_count');
    let tag=tags.get(row.tag_id);
    if(!tag){tag={id:row.tag_id,name:'#'+row.normalized,color:row.color,total:0n,countries:new Map()};tags.set(row.tag_id,tag);}
    const country=normalizeCountry(row.country_code);
    tag.total+=value;tag.countries.set(country,(tag.countries.get(country)??0n)+value);
  }
  return {type:'country_snapshot',asOfMs,validUntilMs:asOfMs+5000,granularity:'country',privacyThreshold:5,
    tags:[...tags.values()].map(tag=>{
      const countries=[];let other=0n;
      for(const [countryCode,count]of tag.countries){
        if(!count)continue;
        if(countryCode!=='ZZ'&&count<5n)other+=count;
        else countries.push({countryCode,activeParticipants:String(count)});
      }
      if(other)countries.push({countryCode:'OTHER',activeParticipants:String(other)});
      countries.sort((a,b)=>a.countryCode.localeCompare(b.countryCode));
      return {id:tag.id,name:tag.name,color:tag.color,activeParticipants:String(tag.total),countries};
    }).sort((a,b)=>a.id.localeCompare(b.id))};
}
