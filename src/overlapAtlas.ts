/**
 * Isolated atlas-spike for #32. Many privacy-approved coarse cells can share
 * one WebGL2 instanced draw; one image-space slot ≠ a geographic coordinate.
 * NOT integrated into the public MapLibre renderer.
 */
import { buildCellPalette, type CellPalette, type ColorEntry, MAX_WEBGL_SECTORS } from './overlapCompositor';

export const MAX_ATLAS_CELLS = 256;
export const ATLAS_TEXTURE_WIDTH = MAX_WEBGL_SECTORS + 1;
export type AtlasCell = { cellKey: string; participants: ColorEntry[] };
export type OverlapAtlas = {
  cells: CellPalette[];
  columns: number;
  rows: number;
  /** 13 texels per cell; 12 RGBA sector entries + 1 RGBA metadata texel. */
  rgba: Uint8Array;
  /** Aggregate totals are metadata, never pixel brightness derived from taps. */
  totalPeople: number;
};

/**
 * Deterministic coarse-cell order. Hard fail rather than silently omit cells
 * or competing hashtags; map viewport paging is a separate design decision.
 */
export function buildOverlapAtlas(cells: AtlasCell[], columns?: number): OverlapAtlas {
  if (!Array.isArray(cells) || cells.length > MAX_ATLAS_CELLS)
    throw new RangeError('Atlas cell budget exceeded');
  if (columns !== undefined && (!Number.isSafeInteger(columns) || columns < 1 || columns > 32))
    throw new RangeError('Invalid atlas columns');
  const entries = [...cells].sort((a,b) =>
    a.cellKey < b.cellKey ? -1 : a.cellKey > b.cellKey ? 1 : 0
  );
  const palettes: CellPalette[] = [];
  const used = new Set<string>();
  let totalPeople = 0;
  for (const cell of entries) {
    if (!cell || typeof cell.cellKey !== 'string' || used.has(cell.cellKey))
      throw new RangeError('Invalid or duplicate coarse cell key');
    used.add(cell.cellKey);
    const palette = buildCellPalette(cell.cellKey, cell.participants);
    totalPeople += palette.totalPeople;
    if (!Number.isSafeInteger(totalPeople)) throw new RangeError('Unsafe atlas total');
    palettes.push(palette);
  }

  // Empty atlas still provides 1 row of zero data to avoid a zero-height
  // WebGL texture allocation. Draw call is skipped when cells.length === 0.
  const cols = columns ?? Math.min(16, Math.max(1, Math.ceil(Math.sqrt(palettes.length))));
  const rows = Math.max(1, Math.ceil(palettes.length / cols));
  const rgba = new Uint8Array(ATLAS_TEXTURE_WIDTH * Math.max(1,palettes.length) * 4);
  const slot = (cell: number, entry: number) => (cell * ATLAS_TEXTURE_WIDTH + entry) * 4;
  const toByte = (x: number) => Math.max(0,Math.min(255,Math.round(x*255)));
  palettes.forEach((palette, cellIndex) => {
    palette.sectors.forEach((sector, i) => {
      const n = slot(cellIndex,i);
      rgba[n] = parseInt(sector.color.slice(1,3),16);
      rgba[n+1] = parseInt(sector.color.slice(3,5),16);
      rgba[n+2] = parseInt(sector.color.slice(5,7),16);
      rgba[n+3] = toByte(sector.to);
    });
    const meta = slot(cellIndex,MAX_WEBGL_SECTORS);
    rgba[meta] = toByte(palette.glow);
    rgba[meta+1] = toByte(palette.offset);
    rgba[meta+2] = palette.sectors.length;
  });
  return { cells:palettes,columns:cols,rows,rgba,totalPeople };
}

/**
 * CPU pick via the exact quantized cutoffs used in the GPU atlas texture.
 * x/y in CSS coordinates from a DOM element's bounding box.
 */
export function pickAtlasSector(
  atlas: OverlapAtlas, u: number, v: number
): { cellKey: string; tag: string; color: string; people: number } | null {
  if (!Number.isFinite(u) || !Number.isFinite(v) || u<0 || u>=1 || v<0 || v>=1)
    return null;
  const col=Math.floor(u*atlas.columns),row=Math.floor(v*atlas.rows);
  const index=row*atlas.columns+col;
  if(index>=atlas.cells.length)return null;
  const palette=atlas.cells[index];
  const localU=u*atlas.columns-col;
  const localV=1-(v*atlas.rows-row);
  const x=(localU-.5)*2,y=(localV-.5)*2;
  const radius=Math.hypot(x,y);
  if(radius>=1 || !palette.sectors.length || palette.glow===0)return null;
  const texel=ATLAS_TEXTURE_WIDTH*index*4;
  const offset=atlas.rgba[texel+MAX_WEBGL_SECTORS*4+1]/255;
  const angle=((Math.atan2(y,x)/(Math.PI*2)+.5+offset)%1+1)%1;
  let chosen=palette.sectors.length-1;
  for(let i=0;i<palette.sectors.length;i++){
    if(angle<atlas.rgba[texel+i*4+3]/255){chosen=i;break;}
  }
  const s=palette.sectors[chosen];
  return {cellKey:palette.cellKey,tag:s.tag,color:s.color,people:s.people};
}

export const ATLAS_VERTEX_GLSL = [
  '#version 300 es',
  'in vec2 aPosition;',
  'uniform int uCols;',
  'uniform int uRows;',
  'out vec2 vUv;',
  'flat out int vCell;',
  'void main(){',
  ' int col=gl_InstanceID%uCols;',
  ' int row=gl_InstanceID/uCols;',
  ' vec2 center=vec2(-1.0+(float(col)*2.0+1.0)/float(uCols),',
  '                 1.0-(float(row)*2.0+1.0)/float(uRows));',
  ' gl_Position=vec4(center+aPosition/vec2(float(uCols),float(uRows)),0.0,1.0);',
  ' vUv=aPosition*.5+.5;',
  ' vCell=gl_InstanceID;',
  '}'
].join('\n');

export const ATLAS_FRAGMENT_GLSL = [
  '#version 300 es',
  'precision highp float;',
  'precision highp int;',
  'precision highp sampler2D;',
  'uniform sampler2D uAtlas;',
  'in vec2 vUv;',
  'flat in int vCell;',
  'out vec4 fragColor;',
  'void main(){',
  ' vec4 meta=texelFetch(uAtlas,ivec2(12,vCell),0);',
  ' int count=int(floor(meta.b*255.0+0.5));',
  ' if(count==0){fragColor=vec4(0.0);return;}',
  ' vec2 p=(vUv-0.5)*2.0;',
  ' float angle=fract(atan(p.y,p.x)/6.28318530718+0.5+meta.g);',
  ' vec3 color=vec3(0.0);',
  ' for(int i=0;i<12;++i){',
  '   if(i>=count)break;',
  '   vec4 value=texelFetch(uAtlas,ivec2(i,vCell),0);',
  '   if(angle<value.a||i==count-1){color=value.rgb;break;}',
  ' }',
  ' float alpha=meta.r*(1.0-smoothstep(0.22,1.0,length(p)));',
  ' fragColor=vec4(color,alpha);',
  '}'
].join('\n');

/**
 * GPU resource lifecycle is explicit: shader/VAO/texture compiled ONCE,
 * palette may be replaced many times without leaking one context per cell.
 */
export class AtlasRenderer {
  readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly vertexArray: WebGLVertexArrayObject;
  private readonly buffer: WebGLBuffer;
  private readonly texture: WebGLTexture;
  private disposed = false;
  drawCalls = 0;

  constructor(canvas: HTMLCanvasElement) {
    const gl=canvas.getContext('webgl2',{alpha:true,preserveDrawingBuffer:true,antialias:false});
    if(!gl)throw new Error('WebGL2 unavailable');
    this.gl=gl;
    const compile=(type:number,source:string)=>{
      const shader=gl.createShader(type);
      if(!shader)throw new Error('Shader allocation failed');
      gl.shaderSource(shader,source);
      gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const error=gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error('Shader compile failed: '+error);
      }
      return shader;
    };
    const vs=compile(gl.VERTEX_SHADER,ATLAS_VERTEX_GLSL),fs=compile(gl.FRAGMENT_SHADER,ATLAS_FRAGMENT_GLSL);
    const program=gl.createProgram();
    if(!program)throw new Error('Program allocation failed');
    gl.attachShader(program,vs);gl.attachShader(program,fs);
    gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Program link failed: '+gl.getProgramInfoLog(program));
    const vao=gl.createVertexArray(),buffer=gl.createBuffer(),texture=gl.createTexture();
    if(!vao||!buffer||!texture)throw new Error('WebGL resource allocation failed');
    this.program=program;this.vertexArray=vao;this.buffer=buffer;this.texture=texture;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,'aPosition');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  }

  draw(atlas: OverlapAtlas): void {
    if(this.disposed)throw new Error('AtlasRenderer disposed');
    const gl=this.gl;
    gl.viewport(0,0,gl.canvas.width,gl.canvas.height);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    if(atlas.cells.length===0)return;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,ATLAS_TEXTURE_WIDTH,atlas.cells.length,0,gl.RGBA,gl.UNSIGNED_BYTE,atlas.rgba);
    gl.uniform1i(gl.getUniformLocation(this.program,'uAtlas'),0);
    gl.uniform1i(gl.getUniformLocation(this.program,'uCols'),atlas.columns);
    gl.uniform1i(gl.getUniformLocation(this.program,'uRows'),atlas.rows);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,atlas.cells.length);
    this.drawCalls++;
    gl.bindVertexArray(null);
  }

  dispose(): void {
    if(this.disposed)return;
    this.disposed=true;
    this.gl.deleteTexture(this.texture);
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteVertexArray(this.vertexArray);
    this.gl.deleteProgram(this.program);
  }
}
