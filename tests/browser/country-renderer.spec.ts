import {test,expect} from '@playwright/test';
test('Native spherical countries are selectable without crediting taps, bounded to two layers and removable',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  let geometryRequests=0;page.on('request',request=>{if(request.resourceType()==='fetch'&&request.url().includes('countries-110m.geojson'))geometryRequests++;});
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
  await page.evaluate(()=>(window as any).firstCountrySource=(window as any).testMap.getSource('live-countries'));
  await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await page.getByRole('button',{name:'Refresh',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).firstCountrySource===(window as any).testMap.getSource('live-countries'))).toBe(true);
  expect(geometryRequests).toBe(1);
  if(info.project.name==='mobile-chromium')await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
  await expect(page.getByTestId('picked')).toHaveText('PT');await expect(page.getByTestId('taps')).toHaveText('0');
  await page.screenshot({path:`test-artifacts/country-globe-${info.project.name}.png`});
  if(info.project.name==='chromium'){
    await page.mouse.move(point.x,point.y);await page.mouse.down();
    await page.evaluate(()=>(window as any).clearCountry());
    await expect.poll(()=>page.evaluate(({x,y})=>(window as any).testMap.queryRenderedFeatures([x,y],{layers:['live-country-fill']}).length,point)).toBe(0);
    await page.mouse.up();await expect(page.getByTestId('taps')).toHaveText('0');
  }else await page.getByRole('button',{name:'Clear',exact:true}).click();
  // Empty data does not destroy resources between five-second snapshots.
  await expect.poll(()=>page.evaluate(async()=>{
    const source=(window as any).testMap.getSource('live-countries');return (await source.getData()).features.length;
  })).toBe(0);
  await page.getByRole('button',{name:'Unmount layer',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>Boolean((window as any).testMap.getSource('live-countries')))).toBe(false);
  await expect(page.getByTestId('error')).toHaveText('');expect(errors).toEqual([]);
});
