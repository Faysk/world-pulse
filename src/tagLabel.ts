const PANEL='#10212d',LIGHT='#e6f3f4';
const valid=(hex:unknown):hex is string=>typeof hex==='string'&&/^#[0-9a-f]{6}$/i.test(hex);
function luminance(hex:string){
  const channels=[1,3,5].map(start=>parseInt(hex.slice(start,start+2),16)/255).map(s=>s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4);
  return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
}
export function tagInk(color?:string){
  if(!valid(color))return LIGHT;
  const foreground=luminance(color),background=luminance(PANEL);
  return (Math.max(foreground,background)+0.05)/(Math.min(foreground,background)+0.05)>=4.5?color:LIGHT;
}
export function tagLabelStyle(color?:string){
  return {color:tagInk(color),...(valid(color)?{borderInlineStart:`3px solid ${color}`,paddingInlineStart:7}:{})};
}
