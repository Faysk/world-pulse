import {test,expect,devices,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
const style={version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#12212d'}}]};
async function open(page:Page){
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:style}));
  await page.goto('/?experiencePreview=1');await expect(page.locator('main.live-world')).toHaveAttribute('data-ready','true');
}
async function select(page:Page,name:string){
  await page.getByLabel(/^(Your hashtag|Sua hashtag)$/,{exact:true}).fill(name);await page.getByRole('button',{name:/^(Enter|Entrar)$/,exact:true}).click();
  await expect(page.getByTestId('live-selected')).toHaveText('#'+name);
}
async function taps(page:Page,n:number){
  const before=await snapshot(page),id=before.activeTag.id;
  const expected=String(BigInt(before.credits.find((row:any)=>row.tagId===id)?.creditedSeconds??'0')+BigInt(n));
  await page.bringToFront();for(let i=0;i<n;i++)await page.getByRole('button',{name:'+1',exact:true}).click();
  await expect.poll(async()=>String((await snapshot(page)).credits.find((row:any)=>row.tagId===id)?.creditedSeconds??'0')).toBe(expected);
  await expect(page.locator('main.live-world')).toHaveAttribute('data-pending','0');
}
// Return only non-authenticating domain fields; never record cookies/bindings.
async function snapshot(page:Page){return page.evaluate(async()=>{
  const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  if(!response.ok)throw new Error('session_snapshot_failed');
  const value=await response.json();return {activeTag:value.activeTag,credits:value.credits,geoConsent:value.geoConsent,geoCountry:value.geoCountry,regionCell:value.regionCell};
});}
test('Private HTTPS to real Neon pooler preserves cookies, independent sessions, retry and consent',async({page,browser},info)=>{
  const second=await browser.newContext({...(info.project.name==='mobile'?devices['Pixel 7']:devices['Desktop Chrome']),baseURL:'https://127.0.0.1:4178',ignoreHTTPSErrors:true});
  const other=await second.newPage(),name='smoke_'+randomUUID().slice(0,8),another='smoke_'+randomUUID().slice(0,8);
  try{
    await open(page);await open(other);await select(page,name);await select(other,name);
    const first=await snapshot(page),independent=await snapshot(other);
    expect(first.activeTag.id).toBe(independent.activeTag.id);expect(first.activeTag.color).toBe(independent.activeTag.color);
    const cookie=(await page.context().cookies()).find(item=>item.name==='wp_session');
    expect({secure:cookie?.secure,httpOnly:cookie?.httpOnly,sameSite:cookie?.sameSite}).toEqual({secure:true,httpOnly:true,sameSite:'Lax'});
    expect(await page.evaluate(()=>window.isSecureContext&&Boolean(navigator.locks))).toBe(true);
    await taps(page,30);await taps(other,15);
    expect((await snapshot(page)).credits.find((row:any)=>row.name==='#'+name).creditedSeconds).toBe('30');
    expect((await snapshot(other)).credits.find((row:any)=>row.name==='#'+name).creditedSeconds).toBe('15');
    await page.route('**/api/taps',async route=>{await route.fetch();await route.abort('failed');});
    await page.bringToFront();await page.getByRole('button',{name:'+1',exact:true}).click();
    await expect(page.getByRole('button',{name:'Sincronizar',exact:true})).toHaveCount(0);
    await expect.poll(async()=>(await snapshot(page)).credits.find((row:any)=>row.name==='#'+name).creditedSeconds).toBe('31');
    await page.unroute('**/api/taps');// Background delivery retries automatically.
    await expect(page.locator('main.live-world')).toHaveAttribute('data-pending','0');
    expect((await snapshot(page)).credits.find((row:any)=>row.name==='#'+name).creditedSeconds).toBe('31');
    await select(page,another);await taps(page,2);await page.reload();await expect(page.getByTestId('live-selected')).toHaveText('#'+another);
    const restored=await snapshot(page);
    expect(restored.credits.find((row:any)=>row.name==='#'+name).creditedSeconds).toBe('31');
    expect(restored.credits.find((row:any)=>row.name==='#'+another).creditedSeconds).toBe('2');
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    expect((await snapshot(page)).geoConsent).toBe(false);
    expect((await snapshot(page)).geoCountry).toBe('ZZ');
    await page.screenshot({path:`test-artifacts/staging-smoke-${info.project.name}.png`});
  }finally{await second.close();}
});

test('Regional browser permission stores only a coarse cell on real Neon; withdrawal preserves balance',async({page})=>{
  const name='region_'+randomUUID().slice(0,8);
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({latitude:38.720123,longitude:-9.140456});
  const writes:any[]=[];
  page.on('request',req=>{if(new URL(req.url()).pathname==='/api/location')writes.push(req.postDataJSON());});
  await open(page);await select(page,name);await taps(page,30);
  expect((await snapshot(page)).regionCell).toBe(null);
  await page.getByRole('switch',{name:/^(Location|Localização)$/,exact:true}).click();
  await expect(page.locator('main.live-world')).toHaveAttribute('data-regional-active','true');
  const stored=await snapshot(page);
  expect(stored.geoConsent).toBe(true);
  expect(stored.regionCell).toMatch(/^r1:\d+:\d+$/);
  expect(Object.keys(writes[0])).toEqual(['cell']);
  expect(JSON.stringify(writes)).not.toContain('38.720123');
  expect(JSON.stringify(writes)).not.toContain('-9.140456');
  await expect.poll(async()=>{
    const response=await page.request.get('/api/regions'),payload=await response.json();
    return payload.cells?.find((row:any)=>row.tagId===stored.activeTag.id)?.participants;
  }).toBe('1');
  await page.getByRole('switch',{name:/^(Location|Localização)$/,exact:true}).click();
  await expect.poll(async()=>(await snapshot(page)).regionCell).toBe(null);
  const after=await snapshot(page);expect(after.geoConsent).toBe(false);expect(after.geoCountry).toBe('ZZ');
  expect(after.credits.find((row:any)=>row.tagId===stored.activeTag.id).creditedSeconds).toBe('30');
  await expect.poll(async()=>{
    const payload=await (await page.request.get('/api/regions')).json();
    return payload.cells.filter((row:any)=>row.tagId===stored.activeTag.id).length;
  }).toBe(0);
});
