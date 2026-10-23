import { test, expect } from '@playwright/test';

// The integration smoke test intentionally replaces the third-party map style
// with a local minimal background. We test real MapLibre/WebGL initialization
// without depending on the availability or quotas of a public map tile server.
const minimalMapStyle = {
  version: 8,
  name: 'World Pulse CI mock map',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#121a22' } }]
};

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark(?:\?.*)?$/, route => {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(minimalMapStyle) });
  });
});

test('The globe loads and taps credit seconds without changing people', async ({ page }, info) => {
  const exceptions: string[] = [];
  page.on('pageerror', error => exceptions.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') exceptions.push(message.text());
  });
  await page.goto('/');
  await expect(page.getByTestId('planet-render-status')).toHaveText('RENDER ONLINE', { timeout: 30_000 });
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();

  const isMobile = info.project.name === 'mobile-chromium';
  if (isMobile) {
    await expect(page.locator('#hashtag-ranking')).toBeHidden();
    await expect(page.locator('#visual-lab')).toBeHidden();
  }
  await page.screenshot({
    path: 'test-artifacts/world-pulse-' + info.project.name + '-initial.png',
    fullPage: true
  });
  if (isMobile) {
    await page.getByRole('button', { name: 'Abrir laboratório visual' }).click();
    await page.getByRole('button', { name: 'Abrir ranking de hashtags' }).click();
  }


  const people = page.getByTestId('poc-people-total');
  const totalBefore = await people.innerText();
  const seconds = page.getByTestId('seconds-current');
  await expect(seconds).toHaveText('—');
  const credit = page.getByRole('button', { name: 'Somar 1 segundo à hashtag selecionada' });
  await expect(credit).toBeDisabled();

  await page.getByRole('button', { name: /#GTA6/ }).click();
  await expect(credit).toBeEnabled();
  await expect(seconds).toHaveText('0');
  for (let i = 0; i < 3; i++) await credit.click();
  await expect(seconds).toHaveText('3');
  await expect(people).toHaveText(totalBefore);

  if (isMobile) await page.getByRole('button', { name: 'Abrir ranking de hashtags' }).click();
  await page.getByRole('button', { name: /#Minecraft/ }).click();
  await expect(seconds).toHaveText('0');
  await credit.click();
  await expect(seconds).toHaveText('1');
  if (isMobile) await page.getByRole('button', { name: 'Abrir ranking de hashtags' }).click();
  await page.getByRole('button', { name: /#GTA6/ }).click();
  await expect(seconds).toHaveText('3');
  await expect(people).toHaveText(totalBefore);

  if (!isMobile) {
    // Navigation must not generate a credited second. Exercise real WebGL
    // mouse dragging rather than clicking only on a separate test button.
    const canvas = page.locator('.maplibregl-canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 110, y + 45, { steps: 10 });
      await page.mouse.up();
      await expect(seconds).toHaveText('3');
      await expect(people).toHaveText(totalBefore);
    }
  }

  await page.screenshot({ path: 'test-artifacts/world-pulse-' + info.project.name + '.png', fullPage: true });
  expect(exceptions).toEqual([]);
});

test('Zero participants means zero lights and no loss of navigation', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByTestId('planet-render-status')).toHaveText('RENDER ONLINE', { timeout: 30_000 });

  if (info.project.name === 'mobile-chromium') {
    await page.getByRole('button', { name: 'Abrir laboratório visual' }).click();
    await page.getByRole('button', { name: 'Abrir ranking de hashtags' }).click();
  }
  const slider = page.getByRole('slider', { name: 'Quantidade simulada de pessoas' });
  await slider.fill('0');
  await expect(page.getByTestId('poc-people-total')).toHaveText('0');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();

  await page.getByRole('button', { name: /#GTA6/ }).click();
  await expect(page.getByTestId('seconds-current')).toHaveText('0');
  await page.getByRole('button', { name: 'Somar 1 segundo à hashtag selecionada' }).click();
  await expect(page.getByTestId('seconds-current')).toHaveText('1');
  await expect(page.getByTestId('poc-people-total')).toHaveText('0');

  await page.getByRole('button', { name: 'Sobre este experimento' }).click();
  await expect(page.getByRole('dialog', { name: 'Sobre World Pulse' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar' }).click();
  await expect(page.getByRole('dialog', { name: 'Sobre World Pulse' })).toHaveCount(0);
});
