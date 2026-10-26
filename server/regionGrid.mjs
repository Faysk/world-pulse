// Versioned regional grid. Raw coordinates never leave the browser.
// r1 remains immutable so existing points do not move or gain precision.
const grids={r1:{rows:360},r2:{rows:20040}};
function columns(row,rows){return Math.max(1,Math.round(rows*2*Math.cos((-90+(row+.5)*180/rows)*Math.PI/180)));}
export function regionCell(latitude,longitude){
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude< -90||latitude>90||longitude< -180||longitude>180)throw new Error('invalid_coordinates');
  const rows=grids.r2.rows,row=Math.min(rows-1,Math.floor((latitude+90)/180*rows));
  const n=columns(row,rows),col=Math.min(n-1,Math.floor((longitude+180)/360*n));
  return `r2:${row}:${col}`;
}
export function regionCenter(cell){
  if(typeof cell!=='string'||!/^r[12]:(0|[1-9]\d{0,4}):(0|[1-9]\d{0,4})$/.test(cell))throw new Error('invalid_region_cell');
  const [version,r,c]=cell.split(':'),rows=grids[version].rows,row=Number(r),col=Number(c);
  if(row>=rows||col>=columns(row,rows))throw new Error('invalid_region_cell');
  return [-180+(col+.5)*360/columns(row,rows),-90+(row+.5)*180/rows];
}
