import { test, expect, devices, type Page } from '@playwright/test';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const style={version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#121a22'}}]};
async function openLab(page: Page) {
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:style}));
  await page.goto('/?participationPreview=1');
  await expect(page.getByTestId('participation-status')).toHaveText('Sessão conectada');
}
async function select(page: Page,name: string) {
  await page.getByLabel('Hashtag',{exact:true}).fill(name);
  await page.getByRole('button',{name:'Selecionar hashtag',exact:true}).click();
  await expect(page.getByTestId('participation-selected')).toHaveText('#'+name.toLowerCase());
}
async function taps(page: Page,n: number) {
  for(let i=0;i<n;i++) await page.getByRole('button',{name:'Adicionar 1 segundo',exact:true}).click();
}
const row=(page:Page,name:string)=>page.locator(`[data-tag-name="#${name}"]`);

test('Two independent browsers share a color while credits, return, expiry and retries remain correct',async({page,browser},info)=>{
  // The test process also reads ONLY the fixed disposable loopback database.
  const db=new pg.Pool({connectionString:'postgresql://postgres:local-only@127.0.0.1:5432/world_pulse_ci',ssl:false});
  const second=await browser.newContext({
    ...(info.project.name==='mobile'?devices['Pixel 7']:devices['Desktop Chrome']),
    baseURL:'http://127.0.0.1:4174'
  });
  const b=await second.newPage();
  const name='flow_'+randomUUID().slice(0,8), other='other_'+randomUUID().slice(0,8);
  try {
    await openLab(page);await openLab(b);
    await select(page,name);await select(b,name);
    const colorA=await page.getByTestId('participation-selected').evaluate(el=>getComputedStyle(el).color);
    const colorB=await b.getByTestId('participation-selected').evaluate(el=>getComputedStyle(el).color);
    expect(colorA).toBe(colorB);
    await taps(page,6); await taps(b,2);
    await expect(row(page,name).getByTestId('live-history')).toHaveText('6');
    await expect(row(b,name).getByTestId('live-history')).toHaveText('2');
    const counts=await db.query('SELECT vt.seconds::text FROM world_pulse.visitor_tags vt JOIN world_pulse.tags t ON t.id=vt.tag_id WHERE t.normalized=$1 ORDER BY vt.seconds DESC',[name]);
    expect(counts.rows.map((r:{seconds:string})=>r.seconds)).toEqual(['6','2']);

    const firstId=await row(page,name).getAttribute('data-tag-id');
    await select(page,other);await taps(page,4);
    await expect(row(page,other).getByTestId('live-history')).toHaveText('4');
    await expect(row(page,name).getByTestId('live-history')).toHaveText('6');
    await page.reload();
    await expect(page.getByTestId('participation-status')).toHaveText('Sessão conectada');
    await expect(page.getByTestId('participation-selected')).toHaveText('#'+other);
    await expect(row(page,name).getByTestId('live-history')).toHaveText('6');
    await expect(row(page,name)).toHaveAttribute('data-tag-id',firstId!);

    // Lose the response AFTER the real database transaction committed.
    let lost=true;
    await page.route('**/api/taps',async route=>{
      if(lost){lost=false;await route.fetch();await route.abort('failed');}
      else await route.continue();
    });
    await taps(page,1);
    await expect(page.getByRole('alert')).toContainText('taps pendentes foram preservados');
    await taps(page,1);
    await page.getByRole('button',{name:'Sincronizar agora',exact:true}).click();
    await expect(page.getByTestId('participation-pending')).toHaveText('0');
    await expect(row(page,other).getByTestId('live-history')).toHaveText('6');
    const saved=await db.query('SELECT vt.seconds::text FROM world_pulse.visitor_tags vt JOIN world_pulse.tags t ON t.id=vt.tag_id WHERE t.normalized=$1',[other]);
    expect(saved.rows[0].seconds).toBe('6');

    await db.query("UPDATE world_pulse.visitor_tags SET expires_at=statement_timestamp()-interval '1 hour' WHERE tag_id=$1",[firstId]);
    await page.reload();
    await expect(row(page,name).getByTestId('live-remaining')).toHaveText('0h 00m 00s');
    await expect(row(page,name).getByTestId('live-history')).toHaveText('6');
    await page.screenshot({path:`test-artifacts/participation-${info.project.name}-returned.png`});
    await b.screenshot({path:`test-artifacts/participation-${info.project.name}-second-browser.png`});
  } finally {await second.close();await db.end();}
});

test('Two tabs sharing a cookie always reconcile one server-selected hashtag', async ({page}) => {
  const nameA='tabs_a_'+randomUUID().slice(0,8);
  const nameB='tabs_b_'+randomUUID().slice(0,8);
  const other=await page.context().newPage();
  try {
    // Open serially so both tabs use the SAME HttpOnly cookie.
    await openLab(page);
    await openLab(other);
    await select(page,nameA);
    await expect(other.getByTestId('participation-selected')).toHaveText('#'+nameA);
    await select(other,nameB);
    await expect(page.getByTestId('participation-selected')).toHaveText('#'+nameB);
    await taps(page,1);
    await page.getByRole('button',{name:'Sincronizar agora',exact:true}).click();
    await expect(row(page,nameB).getByTestId('live-history')).toHaveText('1');
    await expect(row(page,nameA)).toHaveCount(0);
  } finally { await other.close(); }
});

test('Expired anonymous cookie with pending taps cannot replay old clicks as a new visitor',async({page})=>{
  const db=new pg.Pool({connectionString:'postgresql://postgres:local-only@127.0.0.1:5432/world_pulse_ci',ssl:false});
  const name='orphan_'+randomUUID().slice(0,8);
  try {
    await openLab(page);
    await select(page,name);
    await page.route('**/api/taps',route=>route.abort('failed'));
    await taps(page,1);
    await expect(page.getByRole('alert')).toContainText('taps pendentes foram preservados');
    await page.unroute('**/api/taps');
    const user=await db.query(`
      SELECT v.id FROM world_pulse.visitors v
      JOIN world_pulse.visitor_tags vt ON vt.visitor_id=v.id
      JOIN world_pulse.tags t ON t.id=vt.tag_id
      WHERE t.normalized=$1
    `,[name]);
    expect(user.rows.length).toBe(1);
    await db.query("UPDATE world_pulse.visitors SET expires_at=now()-interval '1 second' WHERE id=$1",[user.rows[0].id]);
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('quarentena');
    await expect(page.getByRole('button',{name:'Descartar fila antiga e conectar nova sessão'})).toBeVisible();
    await expect(page.getByTestId('participation-pending')).toHaveText('1');
    const existing=await db.query(`
      SELECT COALESCE(SUM(vt.seconds),0)::int AS credited FROM world_pulse.visitor_tags vt
      JOIN world_pulse.tags t ON t.id=vt.tag_id WHERE t.normalized=$1
    `,[name]);
    expect(existing.rows[0].credited).toBe(0);
    await page.getByRole('button',{name:'Descartar fila antiga e conectar nova sessão'}).click();
    await expect(page.getByTestId('participation-status')).toHaveText('Sessão conectada');
    await expect(page.getByTestId('participation-pending')).toHaveText('0');
  } finally {await db.end();}
});

test('Web Locks coordinate simultaneous durable taps in two tabs against the real database',async({page})=>{
  const other=await page.context().newPage();
  const db=new pg.Pool({connectionString:'postgresql://postgres:local-only@127.0.0.1:5432/world_pulse_ci',ssl:false});
  const name='queue_'+randomUUID().slice(0,8);
  const boot=async(p:Page)=>{
    await p.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:style}));
    await p.goto('/');
    await p.evaluate(async()=>{
      const {ParticipationClient}=await import('/src/participationClient.ts');
      (window as any).__queueClient=new ParticipationClient();
      await (window as any).__queueClient.connect();
    });
  };
  try {
    await boot(page); await boot(other);
    await page.evaluate(async n=>{await (window as any).__queueClient.selectTag(n);},name);
    await other.evaluate(async()=>{await (window as any).__queueClient.refreshSession();});
    await Promise.all([page,other].map(p=>p.evaluate(async()=>{
      await Promise.all(Array.from({length:30},()=>(window as any).__queueClient.creditClick()));
    })));
    await Promise.all([page,other].map(p=>p.evaluate(async()=>{await (window as any).__queueClient.flush();})));
    const result=await db.query(`SELECT vt.seconds::text FROM world_pulse.visitor_tags vt
      JOIN world_pulse.tags t ON t.id=vt.tag_id WHERE t.normalized=$1`,[name]);
    expect(result.rows.map((r:{seconds:string})=>r.seconds)).toEqual(['60']);
    for(const p of [page,other]) expect(await p.evaluate(async()=>{
      await (window as any).__queueClient.refreshPending();
      return (window as any).__queueClient.pendingClicks();
    })).toBe(0);

    // Commit the next batch, then close its tab before delivering the response.
    let committed!:()=>void;
    const committedSignal=new Promise<void>(resolve=>{committed=resolve;});
    let release!:()=>void;
    const hold=new Promise<void>(resolve=>{release=resolve;});
    await page.route('**/api/taps',async route=>{
      await route.fetch(); committed(); await hold;
      await route.abort().catch(()=>{});
    });
    await page.evaluate(async()=>{await (window as any).__queueClient.creditClick();});
    const inFlight=page.evaluate(async()=>{await (window as any).__queueClient.flush();}).catch(()=>{});
    await committedSignal;
    const afterClosing=other.evaluate(async()=>{
      await (window as any).__queueClient.creditClick();
      await (window as any).__queueClient.flush();
      return (window as any).__queueClient.pendingClicks();
    });
    await page.close(); release(); await inFlight;
    expect(await afterClosing).toBe(0);
    const final=await db.query(`SELECT vt.seconds::text FROM world_pulse.visitor_tags vt
      JOIN world_pulse.tags t ON t.id=vt.tag_id WHERE t.normalized=$1`,[name]);
    expect(final.rows[0].seconds).toBe('62');
  } finally {await other.close();await db.end();}
});

test('Integrated product flow credits eligible globe taps, restores the server and keeps geography empty',async({page},info)=>{
  const db=new pg.Pool({connectionString:'postgresql://postgres:local-only@127.0.0.1:5432/world_pulse_ci',ssl:false});
  const name='product_'+randomUUID().slice(0,8);
  try{
    await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>route.fulfill({json:style}));
    await page.goto('/?experiencePreview=1');
    await expect(page.getByTestId('live-connection')).toHaveText('Sessão conectada');
    await expect(page.getByTestId('live-geography')).toContainText('Nenhuma posição é inventada');
    await page.getByLabel('Sua hashtag',{exact:true}).fill('#'+name);
    await page.getByRole('button',{name:'Participar',exact:true}).click();
    await expect(page.getByTestId('live-selected')).toHaveText('#'+name);
    const canvas=page.locator('.maplibregl-canvas');const rect=await canvas.boundingBox();
    expect(rect).not.toBeNull();if(!rect)return;
    const x=rect.x+rect.width*.52,y=rect.y+rect.height*.35;
    if(info.project.name==='mobile')await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
    await expect(page.getByTestId('live-pending')).toHaveText('1');
    await page.getByRole('button',{name:'Sincronizar',exact:true}).click();
    await expect(page.getByTestId('live-pending')).toHaveText('0');
    if(info.project.name==='desktop'){
      await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+100,y+45,{steps:10});await page.mouse.up();
      await expect(page.getByTestId('live-pending')).toHaveText('0');
    }
    await page.getByRole('button',{name:'Meus saldos',exact:true}).click();
    await expect(page.locator(`[data-live-tag="#${name}"]`)).toContainText('Histórico: 1 segundo');
    await page.screenshot({path:`test-artifacts/experience-real-${info.project.name}.png`});
    await page.reload();await expect(page.getByTestId('live-selected')).toHaveText('#'+name);
    const result=await db.query('SELECT vt.seconds::text FROM world_pulse.visitor_tags vt JOIN world_pulse.tags t ON t.id=vt.tag_id WHERE t.normalized=$1',[name]);
    expect(result.rows.map((row:{seconds:string})=>row.seconds)).toEqual(['1']);
  }finally{await db.end();}
});
