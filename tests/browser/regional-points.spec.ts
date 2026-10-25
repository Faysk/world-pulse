import {test,expect} from '@playwright/test';
import {regionCell,regionCenter} from '../../server/regionGrid.mjs';
test('One regional point stays small; aggregated counts grow its glow without per-person geometry',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#14222e'}}]}}));
  await page.goto('/tests/fixtures/regional-map.html');
  await expect.poll(()=>page.evaluate(()=>Boolean((window as any).testMap?.getLayer('regional-point-core')))).toBe(true);
  const features=()=>page.evaluate(async()=>(await (window as any).testMap.getSource('regional-points').getData()).features);
  await expect.poll(async()=>(await features()).length).toBe(1);
  const [one]=await features();expect(one.geometry.type).toBe('Point');expect(one.properties.radius).toBe(3.5);expect(one.properties.participants).toBe('1');
  const center=regionCenter(regionCell(38.72,-9.14));
  const point=await page.evaluate(center=>{const p=(window as any).testMap.project(center);return {x:p.x,y:p.y};},center);
  await expect.poll(()=>page.evaluate(({x,y})=>(window as any).testMap.queryRenderedFeatures([x,y],{layers:['regional-point-core']}).length,point)).toBeGreaterThan(0);
  await page.screenshot({path:`test-artifacts/regional-single-${info.project.name}.png`});
  if(info.project.name==='mobile-chromium')await page.touchscreen.tap(point.x,point.y);else {await page.mouse.move(point.x,point.y);await expect(page.getByTestId('picked')).toHaveText('');await page.mouse.click(point.x,point.y);}
  await expect(page.getByTestId('picked')).toHaveText('#fixture');await expect(page.getByTestId('taps')).toHaveText('0');
  await page.getByRole('button',{name:'Many',exact:true}).click();
  await expect.poll(async()=>(await features())[0].properties.participants).toBe('8000000000');
  expect((await features()).length).toBe(1);expect((await features())[0].properties.radius).toBeLessThan(17);
  await page.getByRole('button',{name:'Clear',exact:true}).click();await expect.poll(async()=>(await features()).length).toBe(0);
  await page.getByRole('button',{name:'Unmount',exact:true}).click();expect(await page.evaluate(()=>Boolean((window as any).testMap.getSource('regional-points')))).toBe(false);
  expect(errors).toEqual([]);
});
