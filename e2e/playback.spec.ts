import { test, expect } from "@playwright/test";

test("game change resets toward shot one and court stays usable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Wembanyama/i })).toBeVisible();

  const select = page.getByLabel("Playoff game");
  await expect(select).toBeVisible({ timeout: 30_000 });

  const options = select.locator("option");
  const count = await options.count();
  expect(count).toBeGreaterThanOrEqual(22);

  // Switch to second game
  const value = await options.nth(1).getAttribute("value");
  await select.selectOption(value!);

  await expect(page.getByText(/Shot 1 \//)).toBeVisible({ timeout: 15_000 });

  // Scene 2 tab
  await page.getByRole("button", { name: "Full playoff" }).click();
  await expect(page.getByLabel("Full playoff shot chart")).toBeVisible();
  await page.getByRole("button", { name: "Paint" }).click();
  await expect(page.getByText(/showing/)).toBeVisible();
});
