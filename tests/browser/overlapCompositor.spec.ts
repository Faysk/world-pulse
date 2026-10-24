import {test,expect} from '@playwright/test';

test('WebGL2 draws one pass with separate original hashtag colors',async({page},info)=>{
  const errors: string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/experiments/overlap-lab.html');
  await expect(page.getByTestId('render-status')).toContainText('compositor ativo',{timeout:30000});
  await expect(page.getByTestId('total')).toHaveText('555');
  await expect(page.getByTestId('tags')).toHaveText('3');
  const pixels=await page.evaluate(()=>{
    const lab=(window as typeof window & {__overlapLab:any}).__overlapLab;
    const {canvas,palette,gl}=lab;
    const result=[];
    for (const sector of palette.sectors) {
      const angle=((sector.from+sector.to)/2-palette.offset-.5)*2*Math.PI;
      const x=Math.round((.5+.25*Math.cos(angle))*canvas.width);
      const y=Math.round((.5+.25*Math.sin(angle))*canvas.height);
      const out=new Uint8Array(4);
      gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,out);
      result.push({tag:sector.tag,color:sector.color,rgba:[...out]});
    }
    return {pixels:result,glError:gl.getError()};
  });
  expect(pixels.glError).toBe(0);
  for(const p of pixels.pixels) {
    const target=[1,3,5].map(i=>parseInt(p.color.slice(i,i+2),16));
    for(let i=0;i<3;i++)expect(Math.abs(p.rgba[i]-target[i])).toBeLessThan(14);
    expect(p.rgba[3]).toBeGreaterThan(35);
  }
  expect(errors).toEqual([]);
  await page.screenshot({path:'test-artifacts/overlap-'+info.project.name+'-three-colors.png'});
});

test('Minority hashtag stays visible and the demo does not imply click credit',async({page})=>{
  await page.goto('/experiments/overlap-lab.html');
  await page.getByRole('button',{name:'1 contra 999'}).click();
  await expect(page.getByTestId('total')).toHaveText('1.000');
  await expect(page.getByTestId('tags')).toHaveText('2');
  const pick=await page.evaluate(()=>{
    const lab=(window as typeof window & {__overlapLab:any}).__overlapLab;
    const p=lab.palette;
    const sector=p.sectors.find((s:any)=>s.tag==='lofi');
    const angle=((sector.from+sector.to)/2-p.offset-.5)*2*Math.PI;
    return {x:(.5+.26*Math.cos(angle))*360,y:(.5-.26*Math.sin(angle))*360};
  });
  const box=await page.getByTestId('overlap-canvas').boundingBox();
  expect(box).not.toBeNull();
  if(!box)return;
  await page.mouse.click(box.x+pick.x/360*box.width,box.y+pick.y/360*box.height);
  await expect(page.getByTestId('selected')).toHaveText('#lofi');
  await expect(page.getByTestId('total')).toHaveText('1.000');
  await page.getByRole('button',{name:'Sem atividade'}).click();
  await expect(page.getByTestId('total')).toHaveText('0');
  await expect(page.getByTestId('tags')).toHaveText('0');
  await expect(page.getByTestId('render-status')).toContainText('compositor ativo');
});

test('Single WebGL2 pass scales with synthetic counts without per-person geometry',async({page},info)=>{
  await page.goto('/experiments/overlap-lab.html');
  await page.getByRole('button',{name:'1 trilhão sintético'}).click();
  await expect(page.getByTestId('total')).toHaveText('1.000.000.000.000');
  await expect(page.getByTestId('tags')).toHaveText('3');
  const result=await page.evaluate(()=>{
    const lab=(window as typeof window & {__overlapLab:any}).__overlapLab;
    return {people:lab.palette.totalPeople,tags:lab.palette.sectors.length,glError:lab.gl.getError()};
  });
  expect(result).toEqual({people:1_000_000_000_000,tags:3,glError:0});
  await page.screenshot({path:'test-artifacts/overlap-'+info.project.name+'-one-trillion.png'});
});
