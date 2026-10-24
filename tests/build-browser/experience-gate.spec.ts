import {test,expect} from '@playwright/test';
test('Only an explicitly approved preview build can mount the connected experience',async({page},info)=>{
  let requests=0;
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[]}}));
  await page.route('**/api/**',route=>{requests++;return route.fulfill({status:503,json:{error:'participation_disabled'}});});
  await page.goto('/?experiencePreview=1&participationPreview=1');
  if(info.project.name==='production'){
    await expect(page.getByText('DEMO COM DADOS SIMULADOS')).toBeAttached();
    await expect(page.getByRole('main',{name:'World Pulse participação'})).toHaveCount(0);
    await expect(page.getByRole('region',{name:'Laboratório de participação isolada'})).toHaveCount(0);
    expect(requests).toBe(0);
  }else{
    await expect(page.getByRole('main',{name:'World Pulse participação'})).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('ainda não está disponível');
    expect(requests).toBeGreaterThan(0);
  }
});
