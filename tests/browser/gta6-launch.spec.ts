import { expect, test } from '@playwright/test';

const minimalMapStyle = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#10101b' } }]
};

test('GTA VI keeps Brazil primary and paints global regions by default without unnecessary toggle', async ({ page }) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  const apiCalls: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls.push(request.url());
  });
  // Freeze before the launch, independent of the date this CI is executed.
  await page.clock.setFixedTime(new Date('2026-11-17T18:00:00Z'));
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/, route =>
    route.fulfill({ json: minimalMapStyle })
  );
  await page.goto('/?gta6LaunchPreview=1');

  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect(page.locator('.gta-launch-br-title').getByRole('heading', { name: 'Brasil' })).toBeVisible();
  await expect(page.getByRole('timer', { name: 'Contagem regressiva do Brasil' })).toHaveText(/\d\d:\d\d:\d\d/);
  await expect(page.getByText('19 NOV · 00:00 (horário de Brasília)')).toBeVisible();
  await expect(page.getByText('OUTROS MERCADOS CONFIRMADOS')).toBeVisible();
  await expect(page.locator('.gta-launch-market')).toHaveCount(3);

  // The former hero and technical footer are gone. Sources remain available on demand.
  await expect(page.getByText('WORLD MOMENT / 001')).toHaveCount(0);
  await expect(page.locator('.gta-launch-footer')).toHaveCount(0);
  await expect(page.getByText(/Uma nova Vice City/)).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Informações e fontes' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Informações e fontes' }).click();
  await expect(page.getByRole('dialog', { name: 'Informações e fontes' })).toBeVisible();
  await expect(page.getByRole('link', { name: /PlayStation Store Brasil/ })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar informações' }).click();

  // Worldwide wave is always visible. There is no extra mode toggle.
  await expect(page.getByRole('button', { name: /Simular mundo|Onda mundial|Só confirmados/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Regiões' }).click();
  await expect(page.locator('.gta-launch-region')).toHaveCount(170);
  await expect(page.getByRole('heading', { name: 'Brasil' }).last()).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar território' }).fill('Coreia do Norte');
  await expect(page.locator('.gta-launch-region')).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Buscar território' }).fill('Coreia do Sul');
  await expect(page.locator('.gta-launch-region')).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Buscar território' }).fill('Nigéria');
  await expect(page.locator('.gta-launch-region')).toHaveCount(1);
  await page.getByRole('button', { name: 'Fechar regiões' }).click();

  await page.getByRole('button', { name: /Ver onda em 45s/ }).click();
  await expect(page.locator('.gta-launch-cinema')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Pausar câmera/ }).click();
  await expect(page.getByRole('button', { name: /Retomar câmera/ })).toBeVisible();
  await expect(page.locator('.gta-launch-cinema')).toHaveCount(0);
  await page.getByRole('button', { name: /Retomar câmera/ }).click();
  await expect(page.getByRole('button', { name: /Pausar câmera/ })).toBeVisible();
  await page.getByRole('button', { name: /Tempo real/ }).click();
  await expect(page.getByRole('button', { name: /Tempo real/ })).toHaveCount(0);
  await page.screenshot({ path: 'test-artifacts/gta6-launch-clean.png' });
  expect(pageErrors).toEqual([]);
  expect(apiCalls).toEqual([]);
});
