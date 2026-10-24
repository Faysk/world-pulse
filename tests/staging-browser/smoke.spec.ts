import {test,expect,devices,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
const style={version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#12212d'}}]};
async function open(page:Page){
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:style}));
  await page.goto('/?experiencePreview=1');await expect(page.getByTestId('live-connection')).toHaveText('Sessão conectada');
}
async function select(page:Page,name:string){
  await page.getByLabel('Sua hashtag',{exact:true}).fill(name);await page.getByRole('button',{name:'Participar',exact:true}).click();
  await expect(page.getByTestId('live-selected')).toHaveText('#'+name);
}
async function taps(page:Page,n:number){
  const before=await snapshot(page),id=before.activeTag.id;
  const expected=String(BigInt(before.credits.find((row:any)=>row.tagId===id)?.creditedSeconds??'0')+BigInt(n));
  await page.bringToFront();for(let i=0;i<n;i++)await page.getByRole('button',{name:'+1 segundo',exact:true}).click();
  await expect.poll(async()=>String((await snapshot(page)).credits.find((row:any)=>row.tagId===id)?.creditedSeconds??'0')).toBe(expected);
  await expect(page.getByTestId('live-pending')).toHaveText('0');
}
// Return only non-authenticating domain fields; never record cookies/bindings.
async function snapshot(page:Page){return page.evaluate(async()=>{
  const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  if(!response.ok)throw new Error('session_snapshot_failed');
  const value=await response.json();return {activeTag:value.activeTag,credits:value.credits,geoConsent:value.geoConsent,geoCountry:value.geoCountry};
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
    await page.bringToFront();await page.getByRole('button',{name:'+1 segundo',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('taps pendentes continuam na fila');
    await page.unroute('**/api/taps');await page.getByRole('button',{name:'Sincronizar',exact:true}).click();
    await expect(page.getByTestId('live-pending')).toHaveText('0');
    expect((await snapshot(page)).credits.find((row:any)=>row.name==='#'+name).creditedSeconds).toBe('31');
    await select(page,another);await taps(page,2);await page.reload();await expect(page.getByTestId('live-selected')).toHaveText('#'+another);
    const restored=await snapshot(page);
    expect(restored.credits.find((row:any)=>row.name==='#'+name).creditedSeconds).toBe('31');
    expect(restored.credits.find((row:any)=>row.name==='#'+another).creditedSeconds).toBe('2');
    await page.getByText('Como funciona e privacidade',{exact:true}).click();
    const sharing=page.getByRole('checkbox',{name:'Compartilhar meu país estimado nas áreas agregadas'});
    await expect(sharing).not.toBeChecked();await sharing.click();await expect(sharing).toBeChecked();
    expect((await snapshot(page)).geoCountry).toBe('ZZ');
    await sharing.click();await expect(sharing).not.toBeChecked();expect((await snapshot(page)).geoConsent).toBe(false);
    await page.screenshot({path:`test-artifacts/staging-smoke-${info.project.name}.png`});
  }finally{await second.close();}
});
