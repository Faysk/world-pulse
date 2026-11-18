import { expect, test } from '@playwright/test';

const minimalMapStyle={
  version:8, sources:{},
  layers:[{id:'background',type:'background',paint:{'background-color':'#10101b'}}]
};
const interceptStyle=async(page:import('@playwright/test').Page)=>{
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/,route=>
    route.fulfill({json:minimalMapStyle}));
};

test('GTA VI public page always highlights next global release and advances automatically',async({page})=>{
  test.setTimeout(95_000);
  const errors:string[]=[];
  const apiCalls:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{
    if(new URL(request.url()).pathname.startsWith('/api/'))apiCalls.push(request.url());
  });
  await page.clock.setFixedTime(new Date('2026-11-18T10:00:00Z'));
  await interceptStyle(page);
  await page.goto('/?gta6LaunchPreview=1');

  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Nova Zelândia'})).toBeVisible();
  await expect(page.getByRole('timer',{name:'Contagem regressiva de Nova Zelândia'})).toHaveText(/\d\d:\d\d:\d\d/);
  await expect(page.getByText(/19 NOV.*00:00.*hora local/)).toBeVisible();
  await expect(page.getByText(/PLAYSTATION STORE · BRASIL/)).toHaveCount(0);
  await expect(page.getByText('AO VIVO')).toBeVisible();
  await expect(page.getByRole('heading',{name:'PRÓXIMAS LIBERAÇÕES'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'ÚLTIMOS 3 LIBERADOS'})).toBeVisible();
  await expect(page.getByText('Aguardando a primeira liberação.')).toBeVisible();
  await expect(page.getByRole('button',{name:/Ver onda|Reiniciar onda|Simular/})).toHaveCount(0);
  await expect(page.getByRole('link',{name:/Voltar ao vivo/})).toHaveCount(0);
  await expect(page.locator('.gta-launch-next-markets').first().locator('.gta-launch-market')).toHaveCount(3);
  await expect(page.locator('.gta-launch-next-markets').first().locator('.gta-launch-market').first()).toContainText('Austrália');
  // At the exact midnight threshold, the hero must advance without reload.
  await page.clock.setFixedTime(new Date('2026-11-18T11:00:00Z'));
  await page.waitForTimeout(550);
  await expect(page.getByRole('heading',{name:'Austrália'})).toBeVisible();
  await expect(page.getByRole('timer',{name:'Contagem regressiva de Austrália'})).toBeVisible();
  await expect(page.locator('.gta-launch-recent .gta-launch-market').first()).toContainText('Nova Zelândia');
  await expect(page.locator('.gta-launch-next-markets').first().locator('.gta-launch-market').first()).not.toContainText('Austrália');

  await expect(page.getByText('WORLD MOMENT / 001')).toHaveCount(0);
  await expect(page.locator('.gta-launch-footer')).toHaveCount(0);
  await page.getByRole('button',{name:'Informações e fontes'}).click();
  await expect(page.getByRole('dialog',{name:'Informações e fontes'})).toContainText('Rockstar');
  await page.getByRole('button',{name:'Fechar informações'}).click();

  await page.getByRole('button',{name:'Regiões'}).click();
  await expect(page.locator('.gta-launch-region')).toHaveCount(62);
  await page.getByRole('searchbox',{name:'Buscar mercado'}).fill('Coreia do Norte');
  await expect(page.locator('.gta-launch-region')).toHaveCount(0);
  await page.getByRole('searchbox',{name:'Buscar mercado'}).fill('Coreia do Sul');
  await expect(page.locator('.gta-launch-region')).toHaveCount(1);
  await page.getByRole('searchbox',{name:'Buscar mercado'}).fill('Hong Kong');
  await expect(page.locator('.gta-launch-region')).toHaveCount(1);
  await page.getByRole('button',{name:'Fechar regiões'}).click();

  // An actual chronological timeline, not a fixed set of countries.
  await page.clock.setFixedTime(new Date('2026-11-18T14:00:00Z'));
  await page.waitForTimeout(600);
  await expect(page.getByRole('heading',{name:'Coreia do Sul'})).toBeVisible();
  await expect(page.getByRole('timer',{name:'Contagem regressiva de Coreia do Sul'})).toBeVisible();
  await expect(page.locator('.gta-launch-recent .gta-launch-market')).toHaveCount(2);
  await expect(page.locator('.gta-launch-recent .gta-launch-market').first()).toContainText('Austrália');
  await expect(page.locator('.gta-launch-recent .gta-launch-market').last()).toContainText('Nova Zelândia');

  await page.screenshot({path:'test-artifacts/gta6-launch-live.png'});
  // Small screens must not push the live status / region controls outside
  // the viewport or cover the brand after responsive typography changes.
  await page.setViewportSize({width:320,height:740});
  const brandBox=await page.locator('.gta-launch-brand').boundingBox();
  const actionsBox=await page.locator('.gta-launch-header-actions').boundingBox();
  expect(brandBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  if (brandBox && actionsBox) {
    expect(brandBox.x + brandBox.width).toBeLessThanOrEqual(actionsBox.x + 2);
    expect(actionsBox.x + actionsBox.width).toBeLessThanOrEqual(321);
  }
  expect(errors).toEqual([]);
  expect(apiCalls).toEqual([]);
});

test('URL-only simulation plays automatically without exposing a public replay button',async({page})=>{
  test.setTimeout(45_000);
  await page.clock.setFixedTime(new Date('2026-11-18T09:00:00Z'));
  await interceptStyle(page);
  await page.goto('/?gta6LaunchPreview=1&simular=3');
  await expect(page.locator('.gta-launch-live')).toContainText('TESTE · 3s');
  await expect(page.getByRole('link',{name:/Voltar ao vivo/})).toBeVisible();
  await expect(page.getByRole('button',{name:/Ver onda|Reiniciar onda|Simular/})).toHaveCount(0);
  await expect(page.locator('.gta-launch-recent .gta-launch-market')).toHaveCount(3,{timeout:15_000});
  await expect(page.locator('.gta-launch-replay-label')).toContainText('Teste concluído');
  await expect(page.getByRole('heading',{name:'ÚLTIMOS 3 LIBERADOS'})).toBeVisible();
});
