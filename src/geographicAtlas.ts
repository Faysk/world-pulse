/**
 * World Pulse #32 — geographic viewport atlas (EXPERIMENT ONLY).
 *
 * Projects already-aggregated coarse cells into a bounded Web Mercator
 * viewport; wraps the antimeridian and draws up to 256 cells per GPU batch.
 * Not a spherical projection, not a MapLibre layer, not a privacy transform.
 * Never pass personal positions, raw IP data or exact device coordinates.
 */
import {
  buildOverlapAtlas, ATLAS_TEXTURE_WIDTH, MAX_ATLAS_CELLS,
  ATLAS_FRAGMENT_GLSL, type AtlasCell, type OverlapAtlas
} from './overlapAtlas.ts';

const MAX_LAT = 85.0511287798066;
const TILE_SIZE = 512;
export type GeoCell = AtlasCell & { lng: number; lat: number };
export type GeoViewport = {
  lng: number; lat: number; zoom: number;
  width: number; height: number; cellZoom: number;
};
export type ScreenGeoCell = { cellKey: string; x: number; y: number; radius: number };
export type GeoAtlasPage = {
  atlas: OverlapAtlas;
  screens: ScreenGeoCell[];
  /** NDC x/y center and x/y half-extent per instance in atlas order. */
  placements: Float32Array;
};
export type GeoViewportPlan = {
  pages: GeoAtlasPage[];
  totalPeople: number;
  visiblePeople: number;
  totalCells: number;
  visibleCells: number;
  hiddenCells: number;
  worldPixels: number;
};
const clampLat = (lat: number) => Math.max(-MAX_LAT,Math.min(MAX_LAT,lat));
const fract = (x: number) => x-Math.floor(x);
const worldX = (lng: number) => fract((lng+180)/360);
const worldY = (lat: number) => {
  const phi=clampLat(lat)*Math.PI/180;
  return (1-Math.log(Math.tan(Math.PI/4+phi/2))/Math.PI)/2;
};
function validateViewport(v: GeoViewport): void {
  if (!v || ![v.lng,v.lat,v.zoom,v.width,v.height].every(Number.isFinite) ||
    Math.abs(v.lat)>90 || v.zoom<0 || v.zoom>16 ||
    !Number.isSafeInteger(v.cellZoom) || v.cellZoom<0 || v.cellZoom>14 ||
    !Number.isSafeInteger(v.width) || !Number.isSafeInteger(v.height) ||
    v.width<64 || v.height<64 || v.width>8192 || v.height>8192) {
    throw new RangeError('Invalid geographic viewport');
  }
}
const wrappedDiff = (x: number): number => ((x+0.5)%1+1)%1-0.5;

/** Nearest periodic copy: -179.8° and +179.8° remain adjacent. */
export function projectCoarsePoint(lng: number,lat: number,viewport: GeoViewport):
  {x:number;y:number} {
  validateViewport(viewport);
  if (![lng,lat].every(Number.isFinite) || Math.abs(lat)>90)
    throw new RangeError('Invalid coarse location');
  const scale=TILE_SIZE*2**viewport.zoom;
  return {
    x:viewport.width/2+wrappedDiff(worldX(lng)-worldX(viewport.lng))*scale,
    y:viewport.height/2+(worldY(lat)-worldY(viewport.lat))*scale
  };
}

/**
 * Exact totals refer to the input aggregated snapshot; visibility is
 * viewport-dependent and never invents/suppresses global participants.
 * Every visible coarse cell is included in some page, with NO sampling.
 * Screens are ordered identically to buildOverlapAtlas's canonical sort.
 */
export function planGeographicAtlas(cells: GeoCell[], viewport: GeoViewport):
  GeoViewportPlan {
  validateViewport(viewport);
  if (!Array.isArray(cells) || cells.length>20000)
    throw new RangeError('Invalid source cell collection or safety limit');
  const seen=new Set<string>();
  const worldPixels=TILE_SIZE*2**viewport.zoom;
  const radius=Math.max(5,Math.min(44,worldPixels/2**viewport.cellZoom*0.29));
  const candidates: {cell:GeoCell;screen:ScreenGeoCell}[]=[];
  let totalPeople=0,visiblePeople=0;
  for(const cell of cells){
    if (!cell || typeof cell.cellKey!=='string' || !cell.cellKey || seen.has(cell.cellKey) ||
      !Array.isArray(cell.participants))throw new RangeError('Invalid or duplicated coarse cell');
    if (!Number.isFinite(cell.lng) || !Number.isFinite(cell.lat) || Math.abs(cell.lat)>90)
      throw new RangeError('Invalid coarse center');
    seen.add(cell.cellKey);
    // Build the palette before culling to validate that the global total
    // includes ALL off-screen sessions and every color/count is legal.
    const palette=buildOverlapAtlas([{cellKey:cell.cellKey,participants:cell.participants}]).cells[0];
    totalPeople+=palette.totalPeople;
    if(!Number.isSafeInteger(totalPeople))throw new RangeError('Unsafe worldwide total');
    if(!palette.sectors.length)continue;
    const projected=projectCoarsePoint(cell.lng,cell.lat,viewport);
    const screen={cellKey:cell.cellKey,x:projected.x,y:projected.y,radius};
    if(screen.x < -radius || screen.x > viewport.width+radius ||
       screen.y < -radius || screen.y > viewport.height+radius)continue;
    visiblePeople+=palette.totalPeople;
    if(!Number.isSafeInteger(visiblePeople))throw new RangeError('Unsafe visible total');
    candidates.push({cell,screen});
  }
  candidates.sort((a,b)=>a.cell.cellKey<b.cell.cellKey?-1:a.cell.cellKey>b.cell.cellKey?1:0);
  const pages:GeoAtlasPage[]=[];
  for(let offset=0;offset<candidates.length;offset+=MAX_ATLAS_CELLS) {
    const subset=candidates.slice(offset,offset+MAX_ATLAS_CELLS);
    const atlas=buildOverlapAtlas(subset.map(x=>x.cell));
    const screens=subset.map(x=>x.screen);
    const placements=new Float32Array(screens.length*4);
    screens.forEach((screen,i)=>{
      placements[4*i]=screen.x/viewport.width*2-1;
      placements[4*i+1]=1-screen.y/viewport.height*2;
      placements[4*i+2]=screen.radius/viewport.width*2;
      placements[4*i+3]=screen.radius/viewport.height*2;
    });
    pages.push({atlas,screens,placements});
  }
  return {
    pages,totalPeople,visiblePeople,totalCells:cells.length,
    visibleCells:candidates.length,hiddenCells:cells.length-candidates.length,
    worldPixels
  };
}

/** CPU pick uses the same quantized arc values uploaded to WebGL. */
export function pickGeographicAtlas(plan: GeoViewportPlan, x: number, y: number):
  {cellKey:string;tag:string;color:string;people:number}|null {
  if (!Number.isFinite(x) || !Number.isFinite(y))return null;
  // Reverse traversal matches painter's order when disks overlap.
  for(let p=plan.pages.length-1;p>=0;p--){
    const page=plan.pages[p];
    for(let i=page.screens.length-1;i>=0;i--){
      const screen=page.screens[i],cell=page.atlas.cells[i];
      const nx=(x-screen.x)/screen.radius,ny=(screen.y-y)/screen.radius;
      if(nx*nx+ny*ny>=1||!cell.sectors.length)continue;
      const base=(i*ATLAS_TEXTURE_WIDTH)*4;
      const offset=page.atlas.rgba[base+12*4+1]/255;
      const angle=fract(Math.atan2(ny,nx)/(Math.PI*2)+.5+offset);
      let selected=cell.sectors.length-1;
      for(let j=0;j<cell.sectors.length;j++){
        if(angle<page.atlas.rgba[base+j*4+3]/255){selected=j;break;}
      }
      const sector=cell.sectors[selected];
      return {cellKey:cell.cellKey,tag:sector.tag,color:sector.color,people:sector.people};
    }
  }
  return null;
}

const VERTEX_GLSL = [
  '#version 300 es',
  'in vec2 aPosition;',
  'in vec4 aPlacement;',
  'out vec2 vUv;',
  'flat out int vCell;',
  'void main(){',
  'gl_Position=vec4(aPlacement.xy+aPosition*aPlacement.zw,0.0,1.0);',
  'vUv=aPosition*0.5+0.5;',
  'vCell=gl_InstanceID;',
  '}'
].join('\n');

/**
 * Single reusable WebGL2 context. One instanced draw per <=256-cell page.
 * This is a 2D Web Mercator research overlay, not MapLibre globe integration.
 */
export class GeographicAtlasRenderer {
  readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly quad: WebGLBuffer;
  private readonly instances: WebGLBuffer;
  private readonly texture: WebGLTexture;
  private disposed=false;
  drawCalls=0;

  constructor(canvas:HTMLCanvasElement) {
    const gl=canvas.getContext('webgl2',{alpha:true,preserveDrawingBuffer:true,antialias:false});
    if(!gl)throw new Error('WebGL2 unavailable');
    this.gl=gl;
    const compile=(type:number,source:string)=>{
      const shader=gl.createShader(type);
      if(!shader)throw new Error('GPU shader allocation');
      gl.shaderSource(shader,source);
      gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))
        throw new Error('Shader compilation: '+gl.getShaderInfoLog(shader));
      return shader;
    };
    const vs=compile(gl.VERTEX_SHADER,VERTEX_GLSL);
    const fs=compile(gl.FRAGMENT_SHADER,ATLAS_FRAGMENT_GLSL);
    const program=gl.createProgram();
    if(!program)throw new Error('GPU program allocation');
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
      throw new Error('Shader linking: '+gl.getProgramInfoLog(program));
    const vao=gl.createVertexArray(),quad=gl.createBuffer(),instances=gl.createBuffer(),texture=gl.createTexture();
    if(!vao||!quad||!instances||!texture)throw new Error('GPU resource allocation');
    this.program=program;this.vao=vao;this.quad=quad;this.instances=instances;this.texture=texture;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,quad);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,'aPosition');
    gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,instances);
    const loc=gl.getAttribLocation(program,'aPlacement');
    gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,4,gl.FLOAT,false,0,0);
    gl.vertexAttribDivisor(loc,1);
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  }

  draw(plan:GeoViewportPlan):number {
    if(this.disposed)throw new Error('GeographicAtlasRenderer disposed');
    const gl=this.gl;
    gl.viewport(0,0,gl.canvas.width,gl.canvas.height);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.uniform1i(gl.getUniformLocation(this.program,'uAtlas'),0);
    for(const page of plan.pages) {
      gl.bindBuffer(gl.ARRAY_BUFFER,this.instances);
      gl.bufferData(gl.ARRAY_BUFFER,page.placements,gl.DYNAMIC_DRAW);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,
        ATLAS_TEXTURE_WIDTH,page.atlas.cells.length,0,gl.RGBA,gl.UNSIGNED_BYTE,page.atlas.rgba);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,page.atlas.cells.length);
      this.drawCalls++;
    }
    gl.bindVertexArray(null);
    return plan.pages.length;
  }
  dispose():void {
    if(this.disposed)return;
    this.disposed=true;
    this.gl.deleteTexture(this.texture);
    this.gl.deleteBuffer(this.instances);
    this.gl.deleteBuffer(this.quad);
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program);
  }
}
