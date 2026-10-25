// Versioned, coarse equal-width regional grid. No raw coordinates leave the browser.
const columns=row=>Math.max(1,Math.round(720*Math.cos((-90+(row+.5)*.5)*Math.PI/180)));
export function regionCell(latitude,longitude){
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude< -90||latitude>90||longitude< -180||longitude>180)throw new Error('invalid_coordinates');
  const row=Math.min(359,Math.floor((latitude+90)*2));
  const n=columns(row),col=Math.min(n-1,Math.floor((longitude+180)/360*n));
  return `r1:${row}:${col}`;
}
export function regionCenter(cell){
  if(typeof cell!=='string'||!/^r1:(0|[1-9]\d{0,2}):(0|[1-9]\d{0,2})$/.test(cell))throw new Error('invalid_region_cell');
  const [,r,c]=cell.split(':'),row=Number(r),col=Number(c);
  if(row>359||col>=columns(row))throw new Error('invalid_region_cell');
  return [-180+(col+.5)*360/columns(row),-90+(row+.5)*.5];
}
