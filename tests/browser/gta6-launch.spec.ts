import { expect, test } from '@playwright/test';

// Exercise the actual MapLibre globe without depending on third-party tile availability.
const minimalMapStyle = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#10101b' } }]
};

test('GTA VI world moment previews a clipped regional launch without calling production APIs', async ({ page }) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  const apiCalls: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls.push(request.url());
  });
  // Freeze the reference date so this test remains valid after launch day.
  await page.clock.setFixedTime(new Date('2026-11-17T18:00:00Z'));
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark/, route =>
    route.fulfill({ json: minimalMapStyle })
  );
  await page.goto('/?gta6LaunchPreview=1');
  await expect(page.getByRole('heading', { name: /O mundo inteiro/ })).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect(page.locator('.gta-launch-region')).toHaveCount(171);
  await expect(page.getByRole('heading', { name: 'Portugal' })).toBeVisible();
  await expect(page.getByText(/Horário de desbloqueio conferido na PlayStation Store/)).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar território' }).fill('Rússia');
  await expect(page.locator('.gta-launch-region')).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Buscar território' }).fill('Brasil');
  await expect(page.locator('.gta-launch-region')).toHaveCount(1);
  await page.getByRole('button', { name: /Brasil/ }).click();
  await expect(page.getByText(/Horário de desbloqueio conferido na PlayStation Store/)).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar território' }).fill('');

  await expect(page.getByRole('progressbar', { name: /Territórios com a virada local concluída/ })).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('searchbox', { name: 'Buscar território' }).fill('Nigéria');
  await expect(page.locator('.gta-launch-region')).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Buscar território' }).fill('');
  await page.getByRole('button', { name: /Ver onda em 45 segundos/ }).click();
  await expect(page.getByText(/Prévia acelerada/)).toBeVisible();
  // A release cue automatically flies toward the current region and reveals
  // its title. The user can pause and resume the camera at any time.
  await expect(page.locator('.gta-launch-cinema')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Pausar câmera/ }).click();
  await expect(page.getByRole('button', { name: /Retomar câmera/ })).toBeVisible();
  await expect(page.locator('.gta-launch-cinema')).toHaveCount(0);
  await page.getByRole('button', { name: /Retomar câmera/ }).click();
  await expect(page.getByRole('button', { name: /Pausar câmera/ })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: /Territórios com a virada local concluída/ })).toHaveAttribute('aria-valuenow', /[1-9]/, { timeout: 30_000 });
  await page.getByRole('button', { name: /Tempo real/ }).click();
  await expect(page.getByText(/Relógio em Portugal/)).toBeVisible();
  await expect(page.getByRole('progressbar', { name: /Territórios com a virada local concluída/ })).toHaveAttribute('aria-valuenow', '0');
  await page.screenshot({ path: 'test-artifacts/gta6-launch-preview.png' });
  expect(pageErrors).toEqual([]);
  expect(apiCalls).toEqual([]);
});
