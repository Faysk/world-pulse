import { test, expect } from '@playwright/test';

// Steam UI tests do not need live map tiles: isolate third-party network
// while exercising the actual React panel in desktop/mobile Chromium.
test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/tiles\.openfreemap\.org\/styles\/dark(?:\?.*)?$/, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 8,
        name: 'Steam panel test background',
        sources: {},
        layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#111923' } }]
      })
    })
  );
});

const sample = {
  source: 'Steam Web API',
  scope: 'curated_sample',
  capturedAt: '2026-10-24T00:00:00.000Z',
  monitoredGames: 16,
  successfulGames: 3,
  games: [
    { appid: 730, name: 'Counter-Strike 2', currentPlayers: 1000, storeUrl: 'https://store.steampowered.com/app/730/' },
    { appid: 570, name: 'Dota 2', currentPlayers: 550, storeUrl: 'https://store.steampowered.com/app/570/' },
    { appid: 275850, name: "No Man's Sky", currentPlayers: 250, storeUrl: 'https://store.steampowered.com/app/275850/' }
  ]
};

test('Steam feed is opt-in and separate from simulated map people', async ({ page }) => {
  await page.route('**/api/steam', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(sample)
  }));
  await page.goto('/');
  const total = page.getByTestId('poc-people-total');
  const initial = await total.count() ? await total.innerText() : null;
  const trigger = page.getByRole('button', { name: 'Abrir dados de jogos Steam' });
  await expect(trigger).toBeVisible();
  await expect(page.getByTestId('steam-panel')).toHaveCount(0);
  await trigger.click();
  const panel = page.getByTestId('steam-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Jogando agora')).toBeVisible();
  await expect(panel.getByText('Counter-Strike 2')).toBeVisible();
  await expect(panel.getByText("No Man's Sky")).toBeVisible();
  await expect(panel.getByText('3 de 16 jogos consultados com sucesso')).toBeVisible();
  await expect(panel.getByText('Não são participantes do World Pulse.')).toBeVisible();
  await expect(panel.locator('.steam-game')).toHaveCount(3);
  await expect(panel.locator('.steam-game').first()).toHaveAttribute('href', 'https://store.steampowered.com/app/730/');
  if (initial !== null) await expect(total).toHaveText(initial);
  await page.getByRole('button', { name: 'Fechar dados de jogos Steam' }).click();
  await expect(panel).toHaveCount(0);
});

test('Steam outage is explicit and does not create fake game numbers', async ({ page }) => {
  await page.route('**/api/steam', route => route.fulfill({
    status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'steam_unavailable' })
  }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir dados de jogos Steam' }).click();
  const panel = page.getByTestId('steam-panel');
  await expect(panel.getByRole('alert')).toContainText('Dados indisponíveis');
  await expect(panel.locator('.steam-game')).toHaveCount(0);
});
