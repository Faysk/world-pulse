import { test, expect } from '@playwright/test';

test('One instanced draw contains up to 256 regions on desktop and mobile',async({page},info)=>{
  test.setTimeout(90_000);
  const errors: string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/experiments/overlap-atlas.html');
  await expect(page.getByTestId('render-status')).toContainText('WebGL2 ativo',{timeout:30000});
  await expect(page.getByTestId('cells')).toHaveText('4');
  await expect(page.getByTestId('calls')).toHaveText('1');
  for(const [label,count] of [['64 regiões','64'],['256 regiões','256'],['0 regiões','0']] as const){
    await page.getByRole('button',{name:label}).click();
    await expect(page.getByTestId('cells')).toHaveText(count);
    await expect(page.getByTestId('calls')).toHaveText(count==='0'?'0':'1');
    expect(await page.evaluate(()=>{
      const lab=(window as typeof window & {__atlasLab:any}).__atlasLab;
      return lab.renderer.gl.getError();
    })).toBe(0);
    if(count==='256') {
      await page.screenshot({path:'test-artifacts/atlas-'+info.project.name+'-256.png',fullPage:true});
    }
  }
  expect(errors).toEqual([]);
});

test('GPU pixels preserve one original hashtag pigment per coarse region',async({page})=>{
  await page.goto('/experiments/overlap-atlas.html');
  await expect(page.getByTestId('render-status')).toContainText('WebGL2 ativo');
  await page.getByRole('button',{name:'64 regiões'}).click();
  const result=await page.evaluate(()=>{
    const lab=(window as typeof window & {__atlasLab:any}).__atlasLab;
    const {atlas,renderer}=lab;
    const {gl}=renderer;
    const samples=[];
    const sector=atlas.cells[0].sectors.find((s:any)=>s.tag==='lofi');
    const metadata=(12*4);
    const angle=((sector.from+sector.to)/2-atlas.rgba[metadata+1]/255-.5)*Math.PI*2;
    const radius=.24;
    const x=Math.round(((.5+radius*Math.cos(angle))/atlas.columns)*gl.canvas.width);
    const y=Math.round(((1-(.5+radius*Math.sin(angle)))/atlas.rows)*gl.canvas.height);
    // readPixels uses BOTTOM-left, so y is mirrored from HTML top-down.
    const out=new Uint8Array(4);
    gl.readPixels(x,gl.canvas.height-y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,out);
    samples.push([...out]);
    return {pixels:samples,expected:sector.color,error:gl.getError(),textureBytes:atlas.rgba.length};
  });
  expect(result.error).toBe(0);
  expect(result.textureBytes).toBe(64*13*4);
  expect(result.pixels[0][3]).toBeGreaterThan(35);
  const expected=[1,3,5].map(i=>parseInt(result.expected.slice(i,i+2),16));
  for(let k=0;k<3;k++)expect(Math.abs(result.pixels[0][k]-expected[k])).toBeLessThan(18);
});

test('Selected coarse sector is correct and the selection never changes participants',async({page})=>{
  await page.goto('/experiments/overlap-atlas.html');
  await page.getByRole('button',{name:'64 regiões'}).click();
  const before=await page.getByTestId('people').innerText();
  const pick=await page.evaluate(()=>{
    const atlas=(window as typeof window & {__atlasLab:any}).__atlasLab.atlas;
    const cell=atlas.cells[0];
    const sector=cell.sectors.find((x:any)=>x.tag==='minecraft');
    const offset=atlas.rgba[12*4+1]/255;
    const angle=((sector.from+sector.to)/2-offset-.5)*2*Math.PI;
    return {u:(.5+.20*Math.cos(angle))/atlas.columns,
      v:(.5-.20*Math.sin(angle))/atlas.rows, key:cell.cellKey};
  });
  const b=await page.getByTestId('atlas-canvas').boundingBox();
  expect(b).not.toBeNull();
  if(!b)return;
  await page.mouse.click(b.x+pick.u*b.width,b.y+pick.v*b.height);
  await expect(page.getByTestId('selected')).toContainText('#minecraft');
  await expect(page.getByTestId('selected')).toContainText(pick.key);
  await expect(page.getByTestId('people')).toHaveText(before);
});
