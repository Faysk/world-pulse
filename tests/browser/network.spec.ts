import { test, expect } from "@playwright/test";
test("network filters, source fallback and language work without participation traffic", async ({
  page,
}, testInfo) => {
  const api: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) api.push(r.url());
  });
  // Deterministic UI test: this does not claim provider data availability.
  await page.route("https://radar.cloudflare.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<html><body style="background:#1b1b1b;color:#ddd;font:16px sans-serif;padding:24px">Source chart fixture — UI test only</body></html>',
    }),
  );
  await page.goto("/network/?lang=pt");
  await expect(
    page.getByRole("heading", { name: "A internet, em perspectiva." }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Região", exact: true })
    .selectOption("pt");
  await page.getByRole("button", { name: "24 horas", exact: true }).click();
  await expect(page).toHaveURL(/region=pt&period=1d&lang=pt/);
  await expect(page.locator("iframe")).toHaveAttribute("src", /location=pt/);
  await expect(
    page.getByRole("link", { name: "Abrir gráfico na fonte" }),
  ).toHaveAttribute("href", /traffic\/pt\?dateRange=1d/);
  await page.getByRole("button", { name: "Recarregar gráfico" }).click();
  await expect(
    page.getByRole("link", { name: /Gráfico ausente ou bloqueado/ }),
  ).toBeVisible();
  await page.getByText("Fontes e método", { exact: true }).click();
  await expect(page.getByText(/coleta métricas de uso/)).toBeVisible();
  expect(api).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".network-page").evaluate((el) => (el.scrollTop = 0));
  await page.screenshot({
    path: `test-artifacts/network-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "Idioma", exact: true })
    .selectOption("en");
  await expect(
    page.getByRole("heading", { name: "The internet, in perspective." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Region", exact: true }),
  ).toHaveValue("pt");
});
