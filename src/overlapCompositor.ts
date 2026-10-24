/**
 * Isolated reference renderer (#32). Accepts ONLY coarse privacy-reviewed
 * geographic counts by hashtag, never IPs or individual positions.
 * The public globe is unchanged until visual/FPS acceptance.
 */
export type ColorEntry = { tag: string; color: string; people: number };
export type Sector = ColorEntry & { from: number; to: number };
export type CellPalette = {
  cellKey: string; totalPeople: number; sectors: Sector[];
  offset: number; glow: number;
};

export const MAX_WEBGL_SECTORS = 12;
export const MIN_VISUAL_SECTOR_SHARE = 0.035;
const HEX = /^#[0-9a-fA-F]{6}$/;
const TWO_PI = Math.PI * 2;
const fract = (x: number) => x - Math.floor(x);
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function rotation(key: string): number {
  let hash = 2166136261;
  for (const char of key) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

/** Deterministic order; never overwrites an earlier color with later layers. */
export function buildCellPalette(cellKey: string, entries: ColorEntry[]): CellPalette {
  if (typeof cellKey !== 'string' || !cellKey || cellKey.length > 128 || !Array.isArray(entries))
    throw new RangeError('Invalid coarse cell');
  const grouped = new Map<string, { color: string; people: number }>();
  for (const entry of entries) {
    if (!entry || typeof entry.tag !== 'string' || !entry.tag || entry.tag.length > 128 ||
      !HEX.test(entry.color) || entry.color.toLowerCase() === '#ffffff' ||
      !Number.isSafeInteger(entry.people) || entry.people < 0) {
      throw new RangeError('Invalid aggregate entry');
    }
    if (!entry.people) continue;
    const color = entry.color.toLowerCase();
    const previous = grouped.get(entry.tag);
    if (previous && previous.color !== color) throw new RangeError('Conflicting persistent color');
    const total = (previous?.people ?? 0) + entry.people;
    if (!Number.isSafeInteger(total)) throw new RangeError('Unsafe participant total');
    grouped.set(entry.tag, { color, people: total });
  }
  if (grouped.size > MAX_WEBGL_SECTORS)
    throw new RangeError('More hashtags than available WebGL sectors: do not silently drop them');
  const sorted = [...grouped.entries()].sort((a,b)=> a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  const totalPeople = sorted.reduce((sum,[,e])=>sum+e.people,0);
  if (!Number.isSafeInteger(totalPeople)) throw new RangeError('Unsafe participant total');
  const available = 1 - sorted.length * MIN_VISUAL_SECTOR_SHARE;
  let from = 0;
  const sectors = sorted.map(([tag,item],index) => {
    // Small sectors are kept visible for visual discoverability. Arc area
    // is a UI affordance, NOT a precise statistical representation.
    const to = index === sorted.length-1 ? 1 :
      from + MIN_VISUAL_SECTOR_SHARE + available * item.people / totalPeople;
    const sector = { tag, color:item.color, people:item.people, from, to };
    from = to;
    return sector;
  });
  // Purely simulated field brightness: ONLY active distinct participants.
  const glow = totalPeople ?
    Math.min(.96, .2 + .76 * Math.log10(totalPeople+1) / Math.log10(1e12+1)) : 0;
  return { cellKey, totalPeople, sectors, offset: rotation(cellKey), glow };
}

export function samplePalette(p: CellPalette, u: number, v: number):
  {tag: string | null; color: string | null; alpha: number} {
  if (!Number.isFinite(u) || !Number.isFinite(v)) throw new RangeError('Invalid UV');
  if (!p.sectors.length) return {tag:null,color:null,alpha:0};
  const x = (u-.5)*2, y = (v-.5)*2;
  const angle = fract(Math.atan2(y,x)/TWO_PI + .5 + p.offset);
  const sector = p.sectors.find(s=>angle < s.to) ?? p.sectors[p.sectors.length-1];
  const alpha = p.glow * (1 - smoothstep(.22, 1, Math.hypot(x,y)));
  return {tag:sector.tag,color:sector.color,alpha};
}

export const VERTEX_GLSL = [
  '#version 300 es',
  'in vec2 aPosition; out vec2 vUv;',
  'void main(){gl_Position=vec4(aPosition,0.0,1.0);vUv=aPosition*0.5+0.5;}'
].join('\n');

export const FRAGMENT_GLSL = [
  '#version 300 es',
  'precision highp float;',
  'in vec2 vUv;',
  'uniform int uCount;',
  'uniform vec3 uColors[12];',
  'uniform float uStops[12];',
  'uniform float uOffset; uniform float uGlow;',
  'out vec4 fragColor;',
  'void main(){',
  'vec2 p=(vUv-0.5)*2.0;',
  'float r=length(p);',
  'float a=fract(atan(p.y,p.x)/6.28318530718+0.5+uOffset);',
  'vec3 shade=vec3(0.0);',
  'for(int i=0;i<12;++i){',
  ' if(i>=uCount)break;',
  ' if(a<uStops[i]||i==uCount-1){shade=uColors[i];break;}',
  '}',
  'fragColor=vec4(shade,uGlow*(1.0-smoothstep(0.22,1.0,r)));',
  '}'
].join('\n');

/** Exactly ONE WebGL2 fullscreen draw for the prepared aggregate palette. */
export function renderCellPalette(canvas: HTMLCanvasElement,p: CellPalette): WebGL2RenderingContext {
  const gl=canvas.getContext('webgl2',{preserveDrawingBuffer:true,alpha:true,antialias:false});
  if(!gl)throw new Error('WebGL2 unavailable');
  const compile=(type:number,src:string)=>{
    const shader=gl.createShader(type);
    if(!shader)throw new Error('WebGL shader allocation failed');
    gl.shaderSource(shader,src);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))
      throw new Error('WebGL shader compile: '+gl.getShaderInfoLog(shader));
    return shader;
  };
  const vert=compile(gl.VERTEX_SHADER,VERTEX_GLSL),frag=compile(gl.FRAGMENT_SHADER,FRAGMENT_GLSL);
  const program=gl.createProgram();
  if(!program)throw new Error('WebGL program allocation failed');
  gl.attachShader(program,vert);gl.attachShader(program,frag);gl.linkProgram(program);
  gl.deleteShader(vert);gl.deleteShader(frag);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))
    throw new Error('WebGL shader link: '+gl.getProgramInfoLog(program));
  const buffer=gl.createBuffer();
  if(!buffer)throw new Error('WebGL buffer allocation failed');
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(program,'aPosition');
  gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  gl.useProgram(program);
  const colors=new Float32Array(MAX_WEBGL_SECTORS*3),stops=new Float32Array(MAX_WEBGL_SECTORS);
  p.sectors.forEach((s,i)=>{
    colors[3*i]=parseInt(s.color.slice(1,3),16)/255;
    colors[3*i+1]=parseInt(s.color.slice(3,5),16)/255;
    colors[3*i+2]=parseInt(s.color.slice(5,7),16)/255;
    stops[i]=s.to;
  });
  gl.uniform1i(gl.getUniformLocation(program,'uCount'),p.sectors.length);
  gl.uniform3fv(gl.getUniformLocation(program,'uColors'),colors);
  gl.uniform1fv(gl.getUniformLocation(program,'uStops'),stops);
  gl.uniform1f(gl.getUniformLocation(program,'uOffset'),p.offset);
  gl.uniform1f(gl.getUniformLocation(program,'uGlow'),p.glow);
  gl.viewport(0,0,canvas.width,canvas.height);
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  gl.deleteBuffer(buffer);gl.deleteProgram(program);
  return gl;
}
