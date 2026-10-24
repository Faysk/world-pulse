import { test, expect } from '@playwright/test';
const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';

test('Development lab renders server snapshots and sends taps; public view stays disconnected',async({page},info)=>{
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{
    version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#121a22'}}]
  }}));
  let requests=0;
  const snapshot=(tagId:string,creditedSeconds:string,name:string,color:string,remainingMs:number)=>({
    tagId,creditedSeconds,name,color,remainingMs,serverNowMs:Date.now(),expiresAtMs:Date.now()+remainingMs
  });
  let a=snapshot(first,'28800','#gta6','#ff9465',8*3600000);
  const b=snapshot(second,'1920','#lofi','#b69afa',32*60000);
  await page.route('**/api/session',route=>{requests++;return route.fulfill({json:{
    anonymous:true,sessionFresh:false,sessionBinding:'a'.repeat(64),activeTagId:first,
    activeTag:{id:first,name:a.name,color:a.color},credits:[a,b]
  }});});
  await page.route('**/api/taps',route=>{
    const body=route.request().postDataJSON();
    a=snapshot(first,String(Number(a.creditedSeconds)+body.clicks),a.name,a.color,8*3600000);
    return route.fulfill({json:{...a,batchId:body.batchId,duplicate:false,acceptedClicks:body.clicks}});
  });
  await page.goto('/');
  await expect(page.getByRole('region',{name:'Laboratório de participação isolada'})).toHaveCount(0);
  expect(requests).toBe(0);
  await page.goto('/?participationPreview=1');
  await expect(page.getByTestId('participation-status')).toHaveText('Sessão conectada');
  await expect(page.getByTestId('participation-selected')).toHaveText('#gta6');
  await page.getByRole('button',{name:'Adicionar 1 segundo',exact:true}).click();
  await page.getByRole('button',{name:'Adicionar 1 segundo',exact:true}).click();
  await page.getByRole('button',{name:'Sincronizar agora',exact:true}).click();
  await expect(page.locator('[data-tag-name="#gta6"]').getByTestId('live-history')).toHaveText('28802');
  await expect(page.getByTestId('participation-pending')).toHaveText('0');
  await expect(page.locator('[data-tag-name="#lofi"]').getByTestId('live-history')).toHaveText('1920');
  await page.screenshot({path:`test-artifacts/participation-mock-ui-${info.project.name}.png`});
});
