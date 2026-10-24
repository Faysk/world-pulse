import {test,expect} from '@playwright/test';
test('Native spherical countries are selectable without crediting taps, bounded to two layers and removable',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#172333'}}]}}));
  await page.goto('/tests/fixtures/country-map.html');
  await expect.poll(()=>page.evaluate(()=>Boolean((window as any).testMap?.getLayer('live-country-fill')))).toBe(true);
  const point=await page.evaluate(()=>{
    const map=(window as any).testMap,p=map.project([-8,39]);
    return {x:p.x,y:p.y,layers:map.getStyle().layers.filter((l:any)=>l.id.startsWith('live-country-')).length};
  });
  expect(point.layers).toBe(2);
  // Wait for polygon source layout before querying and the gesture.
  await expect.poll(()=>page.evaluate(({x,y})=>(window as any).testMap.queryRenderedFeatures([x,y],{layers:['live-country-fill']}).length,point)).toBeGreaterThan(0);
  if(info.project.name==='mobile-chromium')await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
  await expect(page.getByTestId('picked')).toHaveText('PT');await expect(page.getByTestId('taps')).toHaveText('0');
  await page.screenshot({path:`test-artifacts/country-globe-${info.project.name}.png`});
  await page.getByRole('button',{name:'Clear',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>Boolean((window as any).testMap.getSource('live-countries')))).toBe(false);
  await expect(page.getByTestId('error')).toHaveText('');expect(errors).toEqual([]);
});
