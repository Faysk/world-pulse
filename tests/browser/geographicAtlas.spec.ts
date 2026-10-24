import { test,expect } from '@playwright/test';

test('Mercator geographic lab keeps global totals while paging 620 coarse regions',async({page},info)=>{
  test.setTimeout(90_000);
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/experiments/geographic-atlas.html');
  await expect(page.getByTestId('render-status')).toContainText('projeção Mercator ativa',{timeout:30000});
  await expect(page.getByTestId('total-cells')).toHaveText('620');
  const global=await page.getByTestId('global-people').innerText();
  await page.getByRole('button',{name:'600 células'}).click();
  await expect(page.getByTestId('visible-cells')).toHaveText('620');
  await expect(page.getByTestId('pages')).toHaveText('3');
  await expect(page.getByTestId('draw-calls')).toHaveText('3');
  await expect(page.getByTestId('visible-people')).toHaveText(global);
  const context=await page.evaluate(()=>{
    const {plan,runner}= (window as typeof window & {__geoAtlasLab:any}).__geoAtlasLab;
    return {
      pages:plan.pages.map((p:any)=>p.atlas.cells.length),
      error:runner.gl.getError(),
      visible:plan.visibleCells,
      cells:plan.totalCells
    };
  });
  expect(context).toEqual({pages:[256,256,108],error:0,visible:620,cells:620});
  await page.screenshot({path:'test-artifacts/geo-mercator-'+info.project.name+'-620.png',fullPage:true});
  await page.locator('#zoom').evaluate((el: HTMLInputElement)=>{el.value='8';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await expect(page.getByTestId('global-people')).toHaveText(global);
  const after=await page.evaluate(()=>{
    const {plan}= (window as typeof window & {__geoAtlasLab:any}).__geoAtlasLab;
    return {visible:plan.visibleCells,calls:plan.pages.length};
  });
  expect(after.visible).toBeLessThan(620);
  await expect(page.getByTestId('draw-calls')).toHaveText(String(after.calls));
  expect(errors).toEqual([]);
});

test('Cells straddling ±180 longitude stay adjacent after moving camera',async({page})=>{
  await page.goto('/experiments/geographic-atlas.html');
  await page.getByRole('button',{name:/Meridiano/}).click();
  await expect(page.getByTestId('center')).toContainText('179.4');
  const locations=await page.evaluate(()=>{
    const {plan}= (window as typeof window & {__geoAtlasLab:any}).__geoAtlasLab;
    return ['seed-0012','seed-0013'].map(key=>{
      const item=plan.pages.flatMap((page:any)=>page.screens).find((s:any)=>s.cellKey===key);
      return item?{x:item.x,y:item.y}:null;
    });
  });
  expect(locations[0]).not.toBeNull();
  expect(locations[1]).not.toBeNull();
  expect(Math.abs(locations[0]!.x-locations[1]!.x)).toBeLessThan(160);
  expect(Math.abs(locations[0]!.x-500)).toBeLessThan(80);
  expect(Math.abs(locations[1]!.x-500)).toBeLessThan(160);
});

test('One visible regional marker is click-selectable without crediting participants',async({page})=>{
  await page.goto('/experiments/geographic-atlas.html');
  await page.getByRole('button',{name:'Zoom Porto'}).click();
  await expect(page.getByTestId('render-status')).toContainText('ativa');
  const before=await page.getByTestId('global-people').innerText();
  const data=await page.evaluate(()=>{
    const {plan}= (window as typeof window & {__geoAtlasLab:any}).__geoAtlasLab;
    for(const pg of plan.pages) {
      const index=pg.screens.findIndex((s:any)=>s.cellKey==='seed-0000');
      if(index<0)continue;
      const screen=pg.screens[index],sector=pg.atlas.cells[index].sectors.find((s:any)=>s.tag==='lofi');
      const offset=pg.atlas.rgba[(index*13+12)*4+1]/255;
      const theta=((sector.from+sector.to)/2-offset-.5)*Math.PI*2;
      return {x:screen.x+.38*screen.radius*Math.cos(theta),
        y:screen.y-.38*screen.radius*Math.sin(theta)};
    }
    throw new Error('Porto marker missing');
  });
  const box=await page.getByTestId('geo-canvas').boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x+data.x/1000*box!.width,box!.y+data.y/600*box!.height);
  await expect(page.getByTestId('chosen')).toContainText('#lofi');
  await expect(page.getByTestId('chosen')).toContainText('seed-0000');
  await expect(page.getByTestId('global-people')).toHaveText(before);
  await page.screenshot({path:'test-artifacts/geo-mercator-porto.png',fullPage:true});
});
