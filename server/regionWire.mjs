// Lossless per-response dictionary. No persisted browser/CDN cache or deltas.
export function compactRegions(snapshot){
  const tags=[],indices=new Map();
  const cells=snapshot.cells.map(row=>{
    let index=indices.get(row.tagId);
    if(index===undefined){index=tags.length;indices.set(row.tagId,index);tags.push([row.tagId,row.name,row.color]);}
    return [row.cell,index,row.participants];
  });
  return {type:'region_compact_v1',asOfMs:snapshot.asOfMs,validUntilMs:snapshot.validUntilMs,tags,cells};
}
export function expandRegions(value){
  if(value?.type!=='region_compact_v1')return value;
  if(!Array.isArray(value.tags)||value.tags.length>2000||!Array.isArray(value.cells)||value.cells.length>2000||
    value.tags.some(tag=>!Array.isArray(tag)||tag.length!==3)||
    value.cells.some(row=>!Array.isArray(row)||row.length!==3||!Number.isInteger(row[1])||row[1]<0||row[1]>=value.tags.length))throw new Error('invalid_region_snapshot');
  return {type:'region_snapshot',asOfMs:value.asOfMs,validUntilMs:value.validUntilMs,
    cells:value.cells.map(([cell,index,participants])=>({cell,tagId:value.tags[index][0],name:value.tags[index][1],color:value.tags[index][2],participants}))};
}
