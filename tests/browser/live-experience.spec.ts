import { test,expect } from '@playwright/test';
const id='11111111-1111-4111-8111-111111111111';
test('Integrated experience preserves queue, restores balances and never shows synthetic participants',async({page},info)=>{
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#14222e'}}]}}));
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  let selected=false,seconds=0,expires=0,failTap=true,calls=0;
  const balance=()=>({tagId:id,name:'#gta6',color:'#ff9465',creditedSeconds:String(seconds),expiresAtMs:expires,serverNowMs:Date.now(),remainingMs:Math.max(0,expires-Date.now())});
  await page.route('**/api/**',async route=>{
    calls++;const path=new URL(route.request().url()).pathname;
    if(path==='/api/session')return route.fulfill({json:{anonymous:true,sessionFresh:false,sessionBinding:'a'.repeat(64),activeTagId:selected?id:null,activeTag:selected?{id,name:'#gta6',color:'#ff9465'}:null,credits:seconds?[balance()]:[]}});
    if(path==='/api/tags')return route.fulfill({json:{tag:{id,name:'#gta6',color:'#ff9465'}}});
    if(path==='/api/select'){selected=true;return route.fulfill({json:{activeTagId:id}});}
    if(path==='/api/taps'){
      if(failTap){failTap=false;return route.abort('failed');}
      const body=route.request().postDataJSON();seconds+=body.clicks;expires=Date.now()+8000;
      return route.fulfill({json:{...balance(),batchId:body.batchId,acceptedClicks:body.clicks,duplicate:false}});
    }
    if(path==='/api/ranking')return route.fulfill({json:{type:'active',asOfMs:Date.now(),metric:'distinct_anonymous_sessions_with_positive_balance',geography:'unavailable',ranking:selected?[{id,name:'#gta6',color:'#ff9465',activeParticipants:seconds?'1':'0',historicalParticipants:'1',creditedSeconds:String(seconds)}]:[]}});
    return route.fulfill({status:404,json:{error:'not_found'}});
  });
  await page.goto('/');await expect(page.getByText('DEMO COM DADOS SIMULADOS')).toBeAttached();expect(calls).toBe(0);
  await page.goto('/?experiencePreview=1');
  await expect(page.getByTestId('live-connection')).toHaveText('Sessão conectada');
  await expect(page.getByTestId('live-geography')).toContainText('Nenhuma posição é inventada');
  await expect(page.getByText('DEMO COM DADOS SIMULADOS')).toHaveCount(0);
  await page.getByLabel('Sua hashtag',{exact:true}).fill('#GTA6');await page.getByRole('button',{name:'Participar',exact:true}).click();
  await expect(page.getByTestId('live-selected')).toHaveText('#gta6');
  await page.getByRole('button',{name:'+1 segundo',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('taps pendentes continuam na fila');
  await expect(page.getByTestId('live-pending')).toHaveText('1');
  await page.getByRole('button',{name:'Sincronizar',exact:true}).click();
  await expect(page.getByTestId('live-pending')).toHaveText('0');
  expect(seconds).toBe(1);
  await page.getByRole('button',{name:'Meus saldos',exact:true}).click();
  await expect(page.locator('[data-live-tag="#gta6"]')).toContainText('Histórico: 1 segundo');
  await page.screenshot({path:`test-artifacts/experience-${info.project.name}.png`});
  await page.reload();await expect(page.getByTestId('live-selected')).toHaveText('#gta6');
  expect(seconds).toBe(1);expect(errors).toEqual([]);
});

test('Connection failure has an explicit retry and no invented zero ranking',async({page})=>{
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[]}}));
  await page.route('**/api/session',route=>route.fulfill({status:503,json:{error:'participation_disabled'}}));
  await page.goto('/?experiencePreview=1');
  await expect(page.getByRole('alert')).toContainText('ainda não está disponível');
  await expect(page.getByRole('button',{name:'Tentar conectar'})).toBeVisible();
  await expect(page.getByRole('button',{name:'+1 segundo',exact:true})).toBeDisabled();
  await expect(page.getByText('Nenhuma hashtag registrada ainda.')).toHaveCount(0);
});
