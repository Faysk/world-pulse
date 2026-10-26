import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark(?:\?.*)?$/, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 8,
        name: 'Gesture QA independent of public tiles',
        sources: {},
        layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#101821' } }]
      })
    })
  );
});

test('Deliberate map tap credits once; drag, wheel and navigation credit nothing', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('planet-render-status')).toHaveText('RENDER ONLINE', { timeout: 30000 });

  const mobile = info.project.name === 'mobile-chromium';
  if (mobile) {
    await page.getByRole('button', { name: 'Abrir laboratório visual' }).click();
    await page.getByRole('button', { name: 'Abrir ranking de hashtags' }).click();
  }
  await page.getByLabel('Cenário de participantes').selectOption('0');
  await page.getByRole('button', { name: /#GTA6/ }).click();
  await expect(page.getByTestId('seconds-current')).toHaveText('0');
  if (mobile) {
    // Setup controls can overlap the intended touch point on a small viewport.
    await page.getByRole('button', { name: 'Recolher laboratório visual', exact: true }).click();
  }

  const canvas = page.locator('.maplibregl-canvas');
  const rect = await canvas.boundingBox();
  expect(rect).not.toBeNull();
  if (!rect) return;
  const x = rect.x + rect.width * .48;
  const y = rect.y + rect.height * .48;

  if (mobile) {
    // Locator actionability verifies the canvas receives the native touch.
    await canvas.tap({ position: { x: rect.width * .48, y: rect.height * .48 } });
    await page.getByRole('button', { name: 'Abrir laboratório visual', exact: true }).click();
  } else {
    await canvas.click({ position: { x: rect.width * .48, y: rect.height * .48 } });
  }
  await expect(page.getByTestId('seconds-current')).toHaveText('1');
  await expect(page.getByTestId('poc-people-total')).toHaveText('0');

  if (!mobile) {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 140, y + 70, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByTestId('seconds-current')).toHaveText('1');
    await page.mouse.wheel(0, -350);
    await expect(page.getByTestId('seconds-current')).toHaveText('1');
  }

  await expect(page.getByTestId('poc-people-total')).toHaveText('0');
  expect(errors).toEqual([]);
});
