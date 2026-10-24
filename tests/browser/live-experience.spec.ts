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


test('Country sharing is optional, displays suppressed groups and survives withdrawal without changing the hashtag',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  let consent=false;
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#14222e'}}]}}));
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/session'){
      const body=route.request().postDataJSON();if(typeof body.geoConsent==='boolean')consent=body.geoConsent;
      return route.fulfill({json:{anonymous:true,sessionFresh:false,sessionBinding:'a'.repeat(64),activeTagId:id,activeTag:{id,name:'#gta6',color:'#5d5de5'},credits:[],geoConsent:consent,geoCountry:consent?'PT':'ZZ',geographyAvailable:true}});
    }
    if(path==='/api/countries')return route.fulfill({json:{type:'country_snapshot',asOfMs:Math.floor(Date.now()/5000)*5000,validUntilMs:Math.floor(Date.now()/5000)*5000+5000,granularity:'country',privacyThreshold:5,tags:[{id,name:'#gta6',color:'#5d5de5',activeParticipants:'12',countries:[{countryCode:'OTHER',activeParticipants:'2'},{countryCode:'PT',activeParticipants:'5'},{countryCode:'ZZ',activeParticipants:'5'}]}]}});
    if(path==='/api/ranking')return route.fulfill({json:{type:'active',asOfMs:Date.now(),metric:'distinct_anonymous_sessions_with_positive_balance',geography:'unavailable',ranking:[]}});
    return route.fulfill({status:404,json:{error:'not_found'}});
  });
  await page.goto('/?experiencePreview=1');
  await expect(page.getByTestId('live-connection')).toHaveText('Sessão conectada');
  await page.getByText('Como funciona e privacidade',{exact:true}).click();
  const checkbox=page.getByRole('checkbox',{name:'Compartilhar meu país estimado nas áreas agregadas'});
  await expect(checkbox).not.toBeChecked();await checkbox.click();await expect(checkbox).toBeChecked();
  await expect(page.getByText(/País atual: PT/)).toBeVisible();
  await checkbox.click();await expect(page.getByText(/País atual: desconhecido/)).toBeVisible();
  await page.getByText('Como funciona e privacidade',{exact:true}).click();
  await page.getByRole('button',{name:'Países',exact:true}).click();
  await expect(page.getByText('Outros países (grupos menores que 5)',{exact:true})).toBeVisible();
  await expect(page.getByTestId('live-selected')).toHaveText('#gta6');
  await expect(page.getByTestId('live-selected')).toHaveCSS('color','rgb(230, 243, 244)');
  await expect(page.getByTestId('live-selected')).toHaveCSS('border-left-color','rgb(93, 93, 229)');
  await expect(page.getByTestId('live-pending')).toHaveText('0');
  await expect(page.getByText('Não foi possível desenhar os países.',{exact:false})).toHaveCount(0);
  await page.screenshot({path:`test-artifacts/countries-${info.project.name}.png`});
  expect(errors).toEqual([]);
});


test('Disabling geography clears old and in-flight areas while authenticated withdrawal stays available',async({page})=>{
  let available=true,consent=true,reads=0,taps=0;
  let secondStarted!:()=>void,release!:()=>void;
  const secondRequest=new Promise<void>(resolve=>{secondStarted=resolve;});
  const heldResponse=new Promise<void>(resolve=>{release=resolve;});
  const expires=Date.now()+3600000;
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#14222e'}}]}}));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/session'){
      const body=route.request().postDataJSON();if(typeof body.geoConsent==='boolean')consent=body.geoConsent;
      return route.fulfill({json:{anonymous:true,sessionFresh:false,sessionBinding:'a'.repeat(64),activeTagId:id,activeTag:{id,name:'#gta6',color:'#ff9465'},credits:[{tagId:id,name:'#gta6',color:'#ff9465',creditedSeconds:'3600',expiresAtMs:expires,serverNowMs:Date.now(),remainingMs:Math.max(0,expires-Date.now())}],geoConsent:consent,geoCountry:consent&&available?'PT':'ZZ',geographyAvailable:available}});
    }
    if(path==='/api/countries'){
      if(++reads===2){secondStarted();await heldResponse;}
      const asOfMs=Math.floor(Date.now()/5000)*5000;
      return route.fulfill({json:{type:'country_snapshot',asOfMs,validUntilMs:asOfMs+5000,granularity:'country',privacyThreshold:5,tags:[{id,name:'#gta6',color:'#ff9465',activeParticipants:'5',countries:[{countryCode:'PT',activeParticipants:'5'}]}]}});
    }
    if(path==='/api/taps')taps++;
    if(path==='/api/ranking')return route.fulfill({json:{type:'active',asOfMs:Date.now(),metric:'distinct_anonymous_sessions_with_positive_balance',geography:'unavailable',ranking:[]}});
    return route.fulfill({status:404,json:{error:'not_found'}});
  });
  try{
    await page.goto('/?experiencePreview=1');
    await expect(page.getByTestId('live-geography')).toContainText('Países agregados');
    await secondRequest;
    available=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await expect(page.getByTestId('live-geography')).toContainText('Nenhuma posição é inventada');
    const returned=page.waitForResponse(response=>response.url().endsWith('/api/countries'));release();await returned;
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await expect(page.getByTestId('live-geography')).toContainText('Nenhuma posição é inventada');
    await page.getByText('Como funciona e privacidade',{exact:true}).click();
    const checkbox=page.getByRole('checkbox',{name:'Compartilhar meu país estimado nas áreas agregadas'});
    await expect(checkbox).toBeChecked();await expect(checkbox).toBeEnabled();
    await checkbox.click();await expect(checkbox).not.toBeChecked();await expect(checkbox).toBeDisabled();
    await expect(page.getByTestId('live-selected')).toHaveText('#gta6');
    await expect(page.getByTestId('live-selected-balance')).not.toHaveText('0h 00m 00s');
    await expect(page.getByTestId('live-pending')).toHaveText('0');expect(taps).toBe(0);expect(consent).toBe(false);
  }finally{release();}
});

test('Country overview pages all hashtags and minority selection never credits time',async({page})=>{
  let selected=0,taps=0;
  const tags=Array.from({length:53},(_,i)=>({id:`11111111-1111-4111-8111-${String(i).padStart(12,'0')}`,name:`#tag${String(i).padStart(2,'0')}`,color:'#33ccff',activeParticipants:'5',countries:[{countryCode:'PT',activeParticipants:'5'}]}));
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[]}}));
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/session')return route.fulfill({json:{anonymous:true,sessionFresh:false,sessionBinding:'a'.repeat(64),activeTagId:tags[selected].id,activeTag:tags[selected],credits:[],geoConsent:false,geoCountry:'ZZ',geographyAvailable:true}});
    if(path==='/api/countries'){const asOfMs=Math.floor(Date.now()/5000)*5000;return route.fulfill({json:{type:'country_snapshot',asOfMs,validUntilMs:asOfMs+5000,granularity:'country',privacyThreshold:5,tags}});}
    if(path==='/api/tags'){selected=tags.findIndex(tag=>tag.name===route.request().postDataJSON().name);return route.fulfill({json:{tag:tags[selected]}});}
    if(path==='/api/select')return route.fulfill({json:{activeTagId:tags[selected].id}});
    if(path==='/api/taps')taps++;
    if(path==='/api/ranking')return route.fulfill({json:{type:'active',asOfMs:Date.now(),metric:'distinct_anonymous_sessions_with_positive_balance',geography:'unavailable',ranking:[]}});
    return route.fulfill({status:404,json:{error:'not_found'}});
  });
  await page.goto('/?experiencePreview=1');
  await expect(page.getByTestId('live-connection')).toHaveText('Sessão conectada');
  await page.getByRole('button',{name:'Países',exact:true}).click();
  const panel=page.getByRole('complementary',{name:'Participação por país'});
  await expect(panel.getByText('Página 1 de 3',{exact:true})).toBeVisible();
  await expect(panel.locator('li button')).toHaveCount(20);
  await panel.getByRole('button',{name:'Próxima',exact:true}).click();
  await expect(panel.getByText('Página 2 de 3',{exact:true})).toBeVisible();
  await page.getByLabel('Buscar hashtag nesta leitura').fill('#tag52');
  await expect(panel.locator('li button')).toHaveCount(1);
  await panel.getByRole('button',{name:'#tag52',exact:true}).click();
  await expect(page.getByTestId('live-selected')).toHaveText('#tag52');
  await panel.getByRole('button',{name:'Focar hashtag selecionada',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Ver todas as cores',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('live-pending')).toHaveText('0');expect(taps).toBe(0);
});
