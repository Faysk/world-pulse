import { test,expect } from '@playwright/test';
const id='11111111-1111-4111-8111-111111111111';

test('Map and open Top 10 share one five-second update; closing the panel stops combined reads',async({page})=>{
  await page.clock.install();
  const reads={regions:0,ranking:0,pulse:0};let selected=false;
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#111'}}]}}));
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/session')return route.fulfill({json:{anonymous:true,sessionFresh:false,sessionBinding:'a'.repeat(64),activeTagId:selected?id:null,activeTag:selected?{id,name:'#fixture',color:'#abcdef'}:null,credits:[],geographyAvailable:true}});
    if(path==='/api/tags')return route.fulfill({json:{tag:{id,name:'#fixture',color:'#abcdef'}}});
    if(path==='/api/select'){selected=true;return route.fulfill({json:{activeTagId:id}});}
    const regions={type:'region_compact_v1',asOfMs:Date.now(),validUntilMs:Date.now()+5000,tags:[],cells:[]};
    const ranking={type:'active',asOfMs:Date.now(),metric:'distinct_anonymous_sessions_with_positive_balance',geography:'unavailable',ranking:[]};
    if(path==='/api/regions'){reads.regions++;return route.fulfill({json:regions});}
    if(path==='/api/ranking'){reads.ranking++;return route.fulfill({json:ranking});}
    if(path==='/api/pulse'){reads.pulse++;return route.fulfill({json:{type:'pulse_snapshot_v1',regions,ranking}});}
    return route.fulfill({status:404,json:{error:'not_found'}});
  });
  await page.goto('/?experiencePreview=1');await expect.poll(()=>reads.regions).toBe(1);
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));
  await page.getByRole('button',{name:'Top 10',exact:true}).click();await expect.poll(()=>reads.pulse).toBe(1);
  for(let i=0;i<12;i++){
    await page.clock.fastForward(5001);await expect.poll(()=>reads.pulse).toBe(i+2);
  }
  expect(reads).toEqual({regions:1,ranking:0,pulse:13});
  await page.getByRole('button',{name:'Top 10',exact:true}).click();
  await page.clock.fastForward(5001);await expect.poll(()=>reads.regions).toBe(2);
  expect(reads.pulse).toBe(13);expect(reads.ranking).toBe(0);
  await page.getByRole('button',{name:'Top 10',exact:true}).click();await expect.poll(()=>reads.pulse).toBe(14);
  await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}));
  await page.clock.fastForward(10001);expect(reads).toEqual({regions:2,ranking:0,pulse:14});
  await page.evaluate(()=>{delete (document as any).hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await expect.poll(()=>reads.pulse).toBe(15);
  await page.getByLabel(/^(Your hashtag|Sua hashtag)$/,{exact:true}).fill('#fixture');
  await page.getByRole('button',{name:/^(Enter|Entrar)$/,exact:true}).click();
  await expect.poll(()=>reads.ranking).toBe(1);
  expect(reads.pulse).toBe(15); // Mutation refreshes ranking alone, not an extra map.
});

test('Read overload honors Retry-After across map and panels while hashtag entry and taps remain available',async({page})=>{
  await page.clock.install();
  let reads=0,blocked=true,selected=false;
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#111'}}]}}));
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/session')return route.fulfill({json:{anonymous:true,sessionFresh:false,sessionBinding:'a'.repeat(64),activeTagId:selected?id:null,activeTag:selected?{id,name:'#fixture',color:'#abcdef'}:null,credits:[],geographyAvailable:true}});
    if(path==='/api/tags')return route.fulfill({json:{tag:{id,name:'#fixture',color:'#abcdef'}}});
    if(path==='/api/select'){selected=true;return route.fulfill({json:{activeTagId:id}});}
    if(route.request().method()==='GET'){
      reads++;
      if(blocked)return route.fulfill({status:429,headers:{'Retry-After':'60'},json:{error:'operation_budget_exhausted'}});
      if(path==='/api/regions')return route.fulfill({json:{type:'region_compact_v1',asOfMs:Date.now(),validUntilMs:Date.now()+5000,tags:[],cells:[]}});
      if(path==='/api/ranking')return route.fulfill({json:{type:'active',asOfMs:Date.now(),metric:'distinct_anonymous_sessions_with_positive_balance',geography:'unavailable',ranking:[]}});
    }
    return route.fulfill({status:404,json:{error:'not_found'}});
  });
  await page.goto('/?experiencePreview=1');await expect.poll(()=>reads).toBe(1);
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));
  await page.getByRole('button',{name:'Top 10',exact:true}).click();
  await page.getByLabel(/^(Your hashtag|Sua hashtag)$/,{exact:true}).fill('#fixture');
  await page.getByRole('button',{name:/^(Enter|Entrar)$/,exact:true}).click();
  await expect(page.getByTestId('live-selected')).toHaveText('#fixture');
  await page.getByRole('button',{name:'+1',exact:true}).click();
  await expect(page.locator('main.live-world')).toHaveAttribute('data-pending','1');
  await page.clock.fastForward(55000);expect(reads).toBe(1);
  blocked=false;await page.clock.fastForward(15000);await expect.poll(()=>reads).toBeGreaterThan(1);
});

test('Closed Top 10 makes no ranking reads; opening refreshes immediately and keeps five-second updates',async({page})=>{
  await page.clock.install();let reads=0;
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#111'}}]}}));
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/session')return route.fulfill({json:{anonymous:true,sessionFresh:false,sessionBinding:'a'.repeat(64),activeTagId:null,activeTag:null,credits:[]}});
    if(path==='/api/ranking'){reads++;return route.fulfill({json:{type:'active',asOfMs:Date.now(),ranking:[]}});}
    return route.fulfill({status:404,json:{error:'not_found'}});
  });
  await page.goto('/?experiencePreview=1');
  await expect(page.locator('main.live-world')).toHaveAttribute('data-ready','true');
  await page.clock.fastForward(20000);expect(reads).toBe(0);
  await page.getByRole('button',{name:'Top 10',exact:true}).click();
  await expect.poll(()=>reads).toBe(1);
  await page.clock.fastForward(6000);await expect.poll(()=>reads).toBe(2);
  await page.getByRole('button',{name:'Top 10',exact:true}).click();
  await page.clock.fastForward(20000);expect(reads).toBe(2);
  await page.getByRole('button',{name:'Top 10',exact:true}).click();await expect.poll(()=>reads).toBe(3);
});
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
  await expect(page.locator('main.live-world')).toHaveAttribute('data-ready','true');

  await expect(page.getByText('DEMO COM DADOS SIMULADOS')).toHaveCount(0);
  await page.getByLabel(/^(Your hashtag|Sua hashtag)$/,{exact:true}).fill('#GTA6');await page.getByRole('button',{name:/^(Enter|Entrar)$/,exact:true}).click();
  await expect(page.getByTestId('live-selected')).toHaveText('#gta6');
  await page.getByRole('button',{name:'+1',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sincronizar',exact:true})).toHaveCount(0);
  await expect(page.locator('main.live-world')).toHaveAttribute('data-pending','1');
  // Background delivery retries automatically.
  await expect(page.locator('main.live-world')).toHaveAttribute('data-pending','0');
  expect(seconds).toBe(1);
  await page.getByRole('button',{name:/^(My time|Meu tempo)$/,exact:true}).click();
  await expect(page.locator('[data-live-tag="#gta6"]')).toContainText('History: 1s');
  await page.screenshot({path:`test-artifacts/experience-${info.project.name}.png`});
  await page.reload();await expect(page.getByTestId('live-selected')).toHaveText('#gta6');
  expect(seconds).toBe(1);expect(errors).toEqual([]);
});

test('Connection failure has an explicit retry and no invented zero ranking',async({page})=>{
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[]}}));
  await page.route('**/api/session',route=>route.fulfill({status:503,json:{error:'participation_disabled'}}));
  await page.goto('/?experiencePreview=1');
  await expect(page.getByRole('alert')).toContainText('Connection unavailable');
  await expect(page.getByRole('button',{name:'Try again'})).toBeVisible();
  await expect(page.getByRole('button',{name:'+1',exact:true})).toBeDisabled();
  await expect(page.getByText('Nenhuma hashtag registrada ainda.')).toHaveCount(0);
});


test('Unified location withdraws legacy country sharing without changing hashtag or balances',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  let consent=true;
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#14222e'}}]}}));
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/session'){
      const body=route.request().postDataJSON();if(typeof body.geoConsent==='boolean')consent=body.geoConsent;
      return route.fulfill({json:{anonymous:true,sessionFresh:false,sessionBinding:'a'.repeat(64),activeTagId:id,activeTag:{id,name:'#gta6',color:'#5d5de5'},credits:[],geoConsent:consent,geoConsentDecided:true,geoCountry:consent?'PT':'ZZ',geographyAvailable:true}});
    }
    if(path==='/api/location'){consent=false;return route.fulfill({json:{regionCell:null,geoConsent:false,geoCountry:'ZZ'}});}
    if(path==='/api/countries')return route.fulfill({json:{type:'country_snapshot',asOfMs:Math.floor(Date.now()/5000)*5000,validUntilMs:Math.floor(Date.now()/5000)*5000+5000,granularity:'country',privacyThreshold:5,tags:[{id,name:'#gta6',color:'#5d5de5',activeParticipants:'12',countries:[{countryCode:'OTHER',activeParticipants:'2'},{countryCode:'PT',activeParticipants:'5'},{countryCode:'ZZ',activeParticipants:'5'}]}]}});
    if(path==='/api/ranking')return route.fulfill({json:{type:'active',asOfMs:Date.now(),metric:'distinct_anonymous_sessions_with_positive_balance',geography:'unavailable',ranking:[]}});
    return route.fulfill({status:404,json:{error:'not_found'}});
  });
  await page.goto('/?experiencePreview=1');
  await expect(page.locator('main.live-world')).toHaveAttribute('data-ready','true');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('switch',{name:/^(Location|Localização)$/,exact:true}).click();
  await expect.poll(()=>consent).toBe(false);
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked','false');
  await page.getByRole('button',{name:/^(Countries|Países)$/,exact:true}).click();
  await page.getByRole('button',{name:'Focus selected hashtag'}).click();await expect(page.getByText('Other countries',{exact:true})).toBeVisible();
  await expect(page.getByTestId('live-selected')).toHaveText('#gta6');
  await expect(page.getByTestId('live-selected')).toHaveCSS('color','rgb(230, 243, 244)');
  await expect(page.getByTestId('live-selected')).toHaveCSS('border-left-color','rgb(93, 93, 229)');
  await expect(page.locator('main.live-world')).toHaveAttribute('data-pending','0');
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
      return route.fulfill({json:{anonymous:true,sessionFresh:false,sessionBinding:'a'.repeat(64),activeTagId:id,activeTag:{id,name:'#gta6',color:'#ff9465'},credits:[{tagId:id,name:'#gta6',color:'#ff9465',creditedSeconds:'3600',expiresAtMs:expires,serverNowMs:Date.now(),remainingMs:Math.max(0,expires-Date.now())}],geoConsent:consent,geoConsentDecided:true,geoCountry:consent&&available?'PT':'ZZ',geographyAvailable:available}});
    }
    if(path==='/api/countries'){
      const asOfMs=Math.floor(Date.now()/5000)*5000;
      return route.fulfill({json:{type:'country_snapshot',asOfMs,validUntilMs:asOfMs+5000,granularity:'country',privacyThreshold:5,tags:[{id,name:'#gta6',color:'#ff9465',activeParticipants:'5',countries:[{countryCode:'PT',activeParticipants:'5'}]}]}});
    }
    if(path==='/api/regions'){
      if(++reads===2){secondStarted();await heldResponse;}
      const asOfMs=Math.floor(Date.now()/5000)*5000;
      return route.fulfill({json:{type:'region_snapshot',asOfMs,validUntilMs:asOfMs+5000,cells:[{cell:'r1:257:266',tagId:id,name:'#gta6',color:'#ff9465',participants:'5'}]}});
    }
    if(path==='/api/location'){consent=false;return route.fulfill({json:{regionCell:null,geoConsent:false,geoCountry:'ZZ'}});}
    if(path==='/api/taps')taps++;
    if(path==='/api/ranking')return route.fulfill({json:{type:'active',asOfMs:Date.now(),metric:'distinct_anonymous_sessions_with_positive_balance',geography:'unavailable',ranking:[]}});
    return route.fulfill({status:404,json:{error:'not_found'}});
  });
  try{
    await page.goto('/?experiencePreview=1');

    await secondRequest;
    available=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));

    const returned=page.waitForResponse(response=>response.url().endsWith('/api/regions'));release();await returned;
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

    const off=page.getByRole('switch',{name:/^(Location|Localização)$/,exact:true});
    await expect(off).toBeEnabled();await off.click();await expect.poll(()=>consent).toBe(false);
    await expect(page.getByTestId('live-selected')).toHaveText('#gta6');
    await expect(page.getByTestId('live-selected-balance')).not.toHaveText('0:00:00');
    await expect(page.locator('main.live-world')).toHaveAttribute('data-pending','0');expect(taps).toBe(0);expect(consent).toBe(false);
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
  await expect(page.locator('main.live-world')).toHaveAttribute('data-ready','true');
  await page.getByRole('button',{name:/^(Countries|Países)$/,exact:true}).click();
  const panel=page.getByRole('complementary',{name:/^(Countries|Países)$/});
  await expect(panel.getByText('1 / 3',{exact:true})).toBeVisible();
  await expect(panel.locator('li button')).toHaveCount(20);
  await panel.getByRole('button',{name:/^(Next|Próxima)$/,exact:true}).click();
  await expect(panel.getByText('2 / 3',{exact:true})).toBeVisible();
  await page.getByLabel('Search hashtags').fill('#tag52');
  await expect(panel.locator('li button')).toHaveCount(1);
  await panel.getByRole('button',{name:'#tag52',exact:true}).click();
  await expect(page.getByTestId('live-selected')).toHaveText('#tag52');
  await panel.getByRole('button',{name:'Focus selected hashtag',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Show all',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('main.live-world')).toHaveAttribute('data-pending','0');expect(taps).toBe(0);
});

test('Taps update immediately while a POST is held; country notice is visible and joins only on participation',async({page})=>{
  let entered!:()=>void,release!:()=>void;const started=new Promise<void>(r=>entered=r),held=new Promise<void>(r=>release=r);
  let selected=false,consent=false,decided=false,seconds=0,expires=0,first=true;
  const balance=()=>({tagId:id,name:'#gta6',color:'#ff9465',creditedSeconds:String(seconds),expiresAtMs:expires,remainingMs:Math.max(0,expires-Date.now()),serverNowMs:Date.now()});
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[]}}));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname,body=route.request().postDataJSON();
    if(path==='/api/session'){
      if(typeof body?.geoConsent==='boolean'){consent=body.geoConsent;decided=true;}
      return route.fulfill({json:{anonymous:true,sessionFresh:false,sessionBinding:'a'.repeat(64),activeTagId:selected?id:null,activeTag:selected?{id,name:'#gta6',color:'#ff9465'}:null,credits:seconds?[balance()]:[],geoConsent:consent,geoConsentDecided:decided,geoCountry:consent?'PT':'ZZ',geographyAvailable:true}});
    }
    if(path==='/api/tags')return route.fulfill({json:{tag:{id,name:'#gta6',color:'#ff9465'}}});
    if(path==='/api/select'){selected=true;return route.fulfill({json:{activeTagId:id}});}
    if(path==='/api/taps'){
      if(first){first=false;entered();await held;}
      seconds+=body.clicks;expires=Math.max(expires,Date.now())+body.clicks*1000;
      return route.fulfill({json:{...balance(),batchId:body.batchId,acceptedClicks:body.clicks,duplicate:false}});
    }
    if(path==='/api/ranking')return route.fulfill({json:{type:'active',asOfMs:Date.now(),metric:'distinct_anonymous_sessions_with_positive_balance',geography:'unavailable',ranking:[]}});
    if(path==='/api/countries'){const asOfMs=Math.floor(Date.now()/5000)*5000;return route.fulfill({json:{type:'country_snapshot',asOfMs,validUntilMs:asOfMs+5000,granularity:'country',privacyThreshold:5,tags:[]}});}
    return route.fulfill({status:404,json:{error:'not_found'}});
  });
  try{
    await page.goto('/?experiencePreview=1');await expect(page.locator('main.live-world')).toHaveAttribute('data-ready','true');
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByRole('switch',{name:/^(Location|Localização)$/,exact:true})).toBeVisible();expect(consent).toBe(false);
    await page.getByLabel(/^(Your hashtag|Sua hashtag)$/,{exact:true}).fill('#gta6');await page.getByRole('button',{name:/^(Enter|Entrar)$/,exact:true}).click();
    await expect(page.getByTestId('live-selected')).toHaveText('#gta6');expect(consent).toBe(false);
    await page.getByRole('button',{name:'+1',exact:true}).click();await started;
    for(let i=0;i<5;i++)await page.getByRole('button',{name:'+1',exact:true}).click();
    await expect(page.locator('main.live-world')).toHaveAttribute('data-pending','6');
    await expect(page.getByTestId('live-selected-balance')).toHaveText('0:00:06');expect(seconds).toBe(0);
    release();await expect(page.locator('main.live-world')).toHaveAttribute('data-pending','0');expect(seconds).toBe(6);
    await page.reload();await expect(page.getByRole('checkbox')).toHaveCount(0);expect(consent).toBe(false);
  }finally{release();}
});

test('A temporary 429 resumes automatically with the identical batch and no manual synchronize',async({page})=>{
  const attempts:any[]=[];
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[]}}));
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/session')return route.fulfill({json:{anonymous:true,sessionFresh:false,sessionBinding:'a'.repeat(64),activeTagId:id,activeTag:{id,name:'#gta6',color:'#ff9465'},credits:[],geoConsent:false,geoConsentDecided:true,geographyAvailable:false}});
    if(path==='/api/taps'){
      const body=route.request().postDataJSON();attempts.push(body);
      if(attempts.length===1)return route.fulfill({status:429,headers:{'Retry-After':'1'},json:{error:'rate_limited'}});
      return route.fulfill({json:{tagId:id,batchId:body.batchId,creditedSeconds:'1',remainingMs:1000,serverNowMs:Date.now(),expiresAtMs:Date.now()+1000}});
    }
    if(path==='/api/ranking')return route.fulfill({json:{type:'active',asOfMs:Date.now(),metric:'distinct_anonymous_sessions_with_positive_balance',geography:'unavailable',ranking:[]}});
    return route.fulfill({status:404,json:{error:'not_found'}});
  });
  await page.goto('/?experiencePreview=1');await expect(page.getByTestId('live-selected')).toHaveText('#gta6');
  await page.getByRole('button',{name:'+1',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sincronizar',exact:true})).toHaveCount(0);
  await expect(page.locator('main.live-world')).toHaveAttribute('data-pending','0');expect(attempts).toHaveLength(2);expect(attempts[0]).toEqual(attempts[1]);
});

test('Modern loading remains visible until the map is ready and respects reduced motion',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  let release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,async route=>{await held;await route.fulfill({json:{version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#14222e'}}]}});});
  await page.route('**/api/**',route=>route.fulfill({status:503,json:{error:'unavailable'}}));
  await page.goto('/?experiencePreview=1');
  try{
    await expect(page.getByRole('status').filter({hasText:'Connecting the world'})).toBeVisible();
    await expect(page.locator('.world-loading-orbit>span')).toHaveCSS('animation-name','none');
    await expect(page.getByText('Abrindo World Pulse…',{exact:true})).toHaveCount(0);
    await page.screenshot({path:`test-artifacts/world-loading-${info.project.name}.png`});
  }finally{release();}
  await expect(page.locator('.world-loading')).toBeHidden();
});


test('Browser location sends only a coarse cell; old country consent never opts into points',async({page,context},info)=>{
  await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:38.720123,longitude:-9.140456});
  let consent=true,cell:string|null=null,remaining=60000,locationWrites:any[]=[];
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#14222e'}}]}}));
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/session')return route.fulfill({json:{anonymous:true,sessionFresh:false,sessionBinding:'a'.repeat(64),activeTagId:id,activeTag:{id,name:'#gta6',color:'#5d5de5'},credits:[{tagId:id,name:'#gta6',color:'#5d5de5',creditedSeconds:'60',remainingMs:remaining,serverNowMs:Date.now(),expiresAtMs:Date.now()+remaining}],geoConsent:consent,geoConsentDecided:true,geoCountry:consent?'PT':'ZZ',geographyAvailable:true,regionCell:cell}});
    if(path==='/api/location'){const body=route.request().postDataJSON();locationWrites.push(body);cell=body.cell;consent=cell!==null;return route.fulfill({json:{regionCell:cell,geoConsent:consent,geoCountry:consent?'PT':'ZZ'}});}
    if(path==='/api/regions'){const asOfMs=Math.floor(Date.now()/5000)*5000;return route.fulfill({json:{type:'region_snapshot',asOfMs,validUntilMs:asOfMs+5000,cells:[]}});}
    if(path==='/api/countries'){const asOfMs=Math.floor(Date.now()/5000)*5000;return route.fulfill({json:{type:'country_snapshot',asOfMs,validUntilMs:asOfMs+5000,granularity:'country',privacyThreshold:5,tags:[]}});}
    if(path==='/api/ranking')return route.fulfill({json:{type:'active',asOfMs:Date.now(),ranking:[]}});
    return route.fulfill({status:404,json:{error:'not_found'}});
  });
  await page.goto('/?experiencePreview=1');
  await expect(page.locator('main.live-world')).toHaveAttribute('data-ready','true');
  expect(locationWrites).toEqual([]);await expect(page.locator('main.live-world')).toHaveAttribute('data-regional-active','false');
  await page.getByRole('switch').click();await expect(page.getByRole('switch')).toHaveAttribute('aria-checked','false');
  await page.getByRole('switch').click();
  await expect(page.locator('main.live-world')).toHaveAttribute('data-regional-active','true');
  expect(locationWrites).toHaveLength(2);expect(Object.keys(locationWrites[1])).toEqual(['cell']);expect(locationWrites[1].cell).toMatch(/^r2:\d+:\d+$/);
  expect(JSON.stringify(locationWrites)).not.toContain('38.720123');expect(JSON.stringify(locationWrites)).not.toContain('-9.140456');
  await page.screenshot({path:`test-artifacts/regional-point-${info.project.name}.png`});
  remaining=0;await page.reload();await expect(page.locator('main.live-world')).toHaveAttribute('data-ready','true');
  await expect(page.locator('main.live-world')).toHaveAttribute('data-regional-active','false');
  await page.getByRole('switch',{name:/^(Location|Localização)$/,exact:true}).click();await expect.poll(()=>cell).toBe(null);
  await expect(page.getByRole('switch',{name:/^(Location|Localização)$/,exact:true})).toBeEnabled();
  expect(locationWrites.at(-1)).toEqual({cell:null});expect(consent).toBe(false);
  await page.reload();await expect(page.locator('main.live-world')).toHaveAttribute('data-ready','true');
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked','false');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
});

test('Denied browser location leaves participation available and sends no location',async({page,context})=>{
  await context.clearPermissions();
  await page.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(_ok:any,fail:any)=>fail({code:1})}});});
  let locationWrites=0;
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#14222e'}}]}}));
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/session')return route.fulfill({json:{anonymous:true,sessionFresh:false,sessionBinding:'a'.repeat(64),activeTagId:id,activeTag:{id,name:'#gta6',color:'#5d5de5'},credits:[],geoConsent:false,geoConsentDecided:true,geoCountry:'ZZ',geographyAvailable:true,regionCell:null}});
    if(path==='/api/location'){locationWrites++;return route.fulfill({json:{regionCell:null}});}
    return route.fulfill({status:503,json:{error:'unavailable'}});
  });
  await page.goto('/?experiencePreview=1');await page.getByRole('switch',{name:/^(Location|Localização)$/,exact:true}).click();
  await expect(page.getByText('Location could not be updated. Check browser permission and try again.',{exact:true})).toBeVisible();
  expect(locationWrites).toBe(0);await expect(page.getByRole('button',{name:'+1',exact:true})).toBeEnabled();
});

test('Clean controls default to English; help is keyboard accessible and regional language follows consent',async({page,context},info)=>{
  await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:38.72,longitude:-9.14});
  let cell:string|null=null;
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#161616'}}]}}));
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/session')return route.fulfill({json:{anonymous:true,sessionFresh:false,sessionBinding:'a'.repeat(64),activeTagId:null,activeTag:null,credits:[],geoConsent:cell!==null,geoCountry:cell?'PT':'ZZ',regionCell:cell,geographyAvailable:true}});
    if(path==='/api/location'){cell=route.request().postDataJSON().cell;return route.fulfill({json:{regionCell:cell,geoConsent:cell!==null,geoCountry:cell?'PT':'ZZ'}});}
    if(path==='/api/ranking')return route.fulfill({json:{type:'active',asOfMs:Date.now(),ranking:[]}});
    if(path==='/api/regions'){const asOfMs=Math.floor(Date.now()/5000)*5000;return route.fulfill({json:{type:'region_snapshot',asOfMs,validUntilMs:asOfMs+5000,cells:[]}});}
    return route.fulfill({status:404,json:{error:'not_found'}});
  });
  await page.goto('/?experiencePreview=1');await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.getByRole('button',{name:'Enter',exact:true})).toBeEnabled();
  await expect(page.getByRole('switch',{name:'Location',exact:true})).toHaveCount(1);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByText('PARTICIPAÇÃO EM TESTE')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Sincronizar|Synchronize/})).toHaveCount(0);
  await page.getByRole('button',{name:'How it works',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link',{name:/GitHub/})).toHaveAttribute('href','https://github.com/Faysk/world-pulse');
  await expect(dialog).toContainText('1 km');await expect(dialog).toContainText('30 days');
  await page.keyboard.press('Escape');await expect(dialog).toBeHidden();
  await expect(page.getByRole('button',{name:'How it works',exact:true})).toBeFocused();
  await page.getByRole('switch').click();await expect(page.locator('html')).toHaveAttribute('lang','pt');
  await expect(page.getByRole('switch',{name:'Localização',exact:true})).toHaveAttribute('aria-checked','true');
  await expect(page.locator('.world-loading')).toBeHidden();
  await page.screenshot({path:`test-artifacts/clean-product-${info.project.name}.png`});
  const dimensions=await page.locator('.live-controls').boundingBox();expect(dimensions!.height).toBeLessThan(260);
  await page.getByRole('switch').click();await expect(page.locator('html')).toHaveAttribute('lang','en');
  await page.getByRole('button',{name:'How it works',exact:true}).click();
  await page.getByLabel('Language',{exact:true}).selectOption('es');await expect(page.locator('html')).toHaveAttribute('lang','es');
  await expect(page.getByRole('dialog')).toContainText('La ubicación es opcional');
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
});

test('Location requests high accuracy and rejects uncertain fixes without sending or blocking taps',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(ok:any,_fail:any,options:any)=>{
      (window as any).locationRequestOptions=options;
      ok({coords:{latitude:38.72,longitude:-9.14,accuracy:(window as any).fixtureAccuracy??25000}});
    }}});
  });
  const writes:any[]=[];
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[]}}));
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/session')return route.fulfill({json:{anonymous:true,sessionFresh:false,sessionBinding:'a'.repeat(64),activeTagId:id,activeTag:{id,name:'#gta6',color:'#5d5de5'},credits:[],geoConsent:false,geoCountry:'ZZ',regionCell:null,geographyAvailable:true}});
    if(path==='/api/location'){const body=route.request().postDataJSON();writes.push(body);return route.fulfill({json:{regionCell:body.cell,geoConsent:true,geoCountry:'PT'}});}
    return route.fulfill({status:503,json:{error:'unavailable'}});
  });
  await page.goto('/?experiencePreview=1');
  for(const accuracy of [25000,1001,NaN,-1]){
    await page.evaluate(value=>{(window as any).fixtureAccuracy=value;},accuracy);
    await page.getByRole('switch').click();
    await expect(page.getByText('Location is too imprecise for your point.',{exact:false})).toBeVisible();
    await expect(page.getByRole('switch')).toHaveAttribute('aria-checked','false');
    await expect(page.getByRole('button',{name:'+1',exact:true})).toBeEnabled();
    expect(writes).toEqual([]);
    if(accuracy===25000){
      await page.getByRole('button',{name:'How it works',exact:true}).click();
      await expect(page.getByTestId('location-accuracy')).toHaveText('25,000 m');
      await page.getByRole('button',{name:'Close',exact:true}).click();
    }
  }
  expect(await page.evaluate(()=>(window as any).locationRequestOptions)).toEqual({enableHighAccuracy:true,maximumAge:0,timeout:20000});
  await page.evaluate(()=>{(window as any).fixtureAccuracy=25;});await page.getByRole('switch').click();
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked','true');
  expect(writes).toHaveLength(1);expect(Object.keys(writes[0])).toEqual(['cell']);expect(writes[0].cell).toMatch(/^r2:/);
  expect(JSON.stringify(writes)).not.toContain('38.72');expect(JSON.stringify(writes)).not.toContain('accuracy');
  await page.getByRole('button',{name:'Como funciona',exact:true}).click();
  await expect(page.getByTestId('location-accuracy')).toHaveText('25 m');
  await page.getByRole('button',{name:'Fechar',exact:true}).click();
  await page.reload();await expect(page.getByRole('button',{name:'How it works',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'How it works',exact:true}).click();
  await expect(page.getByTestId('location-accuracy')).toHaveCount(0);
});

test('Saved legacy resolution is disclosed and moves to one km only after explicit off/on',async({page,context},info)=>{
  await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:41.1826,longitude:-8.3649,accuracy:25});
  let cell:string|null='r1:262:257';const writes:any[]=[];
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:{version:8,sources:{},layers:[]}}));
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/session')return route.fulfill({json:{anonymous:true,sessionFresh:false,sessionBinding:'a'.repeat(64),activeTagId:id,activeTag:{id,name:'#gta6',color:'#5d5de5'},credits:[],geoConsent:cell!==null,geoCountry:cell?'PT':'ZZ',regionCell:cell,geographyAvailable:true}});
    if(path==='/api/location'){const body=route.request().postDataJSON();writes.push(body);cell=body.cell;return route.fulfill({json:{regionCell:cell,geoConsent:cell!==null,geoCountry:cell?'PT':'ZZ'}});}
    if(path==='/api/regions'){const asOfMs=Math.floor(Date.now()/5000)*5000;return route.fulfill({json:{type:'region_snapshot',asOfMs,validUntilMs:asOfMs+5000,cells:[]}});}
    return route.fulfill({status:503,json:{error:'unavailable'}});
  });
  await page.goto('/?experiencePreview=1');await expect(page.getByTestId('legacy-location-notice')).toContainText('55 km');
  expect(writes).toEqual([]);await page.getByRole('button',{name:'Como funciona',exact:true}).click();
  await expect(page.getByTestId('saved-region-size')).toHaveText('~55 km');
  await expect(page.getByTestId('location-accuracy')).toHaveCount(0);
  await expect(page.getByTestId('saved-region-size')).toHaveCSS('font-size',info.project.name==='chromium'?'32px':'30px');
  await expect(page.getByText('Sem leitura nesta aba',{exact:true})).toBeVisible();
  await expect(page.locator('.world-loading')).toBeHidden();
  await page.screenshot({path:`test-artifacts/help-organized-${info.project.name}.png`});
  await page.getByRole('dialog').screenshot({path:`test-artifacts/help-organized-dialog-${info.project.name}.png`});
  const headerBefore=await page.locator('.live-help-header').boundingBox();
  await page.getByText('Como a localização é estimada',{exact:true}).click();
  await expect(page.getByText('O navegador escolhe GPS, Wi-Fi ou dados de rede; o app não consegue identificar a fonte.',{exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'Fechar',exact:true})).toBeVisible();
  const headerAfter=await page.locator('.live-help-header').boundingBox();
  expect(Math.abs(headerBefore!.y-headerAfter!.y)).toBeLessThan(1);
  expect(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.getByRole('button',{name:'Fechar',exact:true}).click();
  await page.getByRole('switch').click();await expect(page.getByRole('switch')).toHaveAttribute('aria-checked','false');
  await expect(page.getByTestId('legacy-location-notice')).toHaveCount(0);
  await page.getByRole('switch').click();await expect(page.getByRole('switch')).toHaveAttribute('aria-checked','true');
  expect(writes).toHaveLength(2);expect(writes[0]).toEqual({cell:null});expect(writes[1].cell).toMatch(/^r2:/);expect(Object.keys(writes[1])).toEqual(['cell']);
  await page.getByRole('button',{name:'Como funciona',exact:true}).click();
  await expect(page.getByTestId('saved-region-size')).toHaveText('~1 km');
  await expect(page.getByTestId('location-accuracy')).toHaveText('25 m');
  await page.reload();await page.getByRole('button',{name:'Como funciona',exact:true}).click();
  await expect(page.getByTestId('saved-region-size')).toHaveText('~1 km');
  expect(writes).toHaveLength(2);
});
