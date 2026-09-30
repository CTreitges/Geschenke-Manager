import { expect, test } from "@playwright/test";
import { formatA11y, loginAs, seriousA11yViolations } from "./helpers";

test("Ben meldet sich an und öffnet das Geschenk für Anna", async ({ page }, testInfo) => {
  await loginAs(page, "Ben");
  await expect(page.getByRole("heading", { name: /Hallo, Ben/ })).toBeVisible();
  const homeA11y = await seriousA11yViolations(page);

  // Stack-Karte „Anna · …" auf Home.
  await page.getByRole("button", { name: /^Anna\b/ }).click();
  await expect(page).toHaveURL(/\/gift\/anna_\d{4}$/);
  await expect(page.getByRole("heading", { name: "Geschenk für Anna" })).toBeVisible();
  const giftA11y = await seriousA11yViolations(page);

  // axe vorerst nur protokollieren (Baseline), nicht failen.
  const log = [formatA11y("home (Ben)", homeA11y), formatA11y("gift/anna (Ben)", giftA11y)].join("\n");
  console.log(log);
  await testInfo.attach("axe-serious-critical.txt", { body: log, contentType: "text/plain" });
});
