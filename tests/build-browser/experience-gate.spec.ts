import {test,expect} from '@playwright/test';
test('Compiled builds require separate preview or production-alpha opt-in',async({page},info)=>{
  let requests=0;
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[]}}));
  await page.route('**/api/**',route=>{requests++;return route.fulfill({status:503,json:{error:'participation_disabled'}});});
  await page.goto(info.project.name==='alpha'?'/':'/?experiencePreview=1&participationPreview=1');
  if(info.project.name==='production'){
    await expect(page.getByText('DEMO COM DADOS SIMULADOS')).toBeAttached();
    await expect(page.getByRole('main',{name:'World Pulse'})).toHaveCount(0);
    await expect(page.getByRole('region',{name:'Laboratório de participação isolada'})).toHaveCount(0);
    expect(requests).toBe(0);
  }else{
    await expect(page.getByRole('main',{name:'World Pulse'})).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Connection unavailable');
    expect(requests).toBeGreaterThan(0);
  }
});
