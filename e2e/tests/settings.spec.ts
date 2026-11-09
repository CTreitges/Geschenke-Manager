import { expect, test } from "@playwright/test";
import { GROUP_ID, seed, setDarkMode } from "../emu-seed.mjs";
import { formatA11y, loginAs, seriousA11yViolations } from "./helpers";

// Einstellungen: feste Reihenfolge der Gruppen, Passwort ändern als Sheet,
// Identität wechseln über das IdentitySheet, „Wo mache ich mit?“ als Sheet.

test.beforeEach(async () => {
  await seed();
});

test.afterAll(async () => {
  await seed();
});

test("Gruppen in der Reihenfolge Du → … → Gefahrenzone, ohne Kontrastfehler", async ({ page }) => {
  await loginAs(page, "Anna");
  await page.getByRole("link", { name: "Einstellungen" }).click();
  await expect(page.getByRole("heading", { name: "Einstellungen", level: 1 })).toBeVisible();

  const groups = page.getByRole("main").getByRole("heading", { level: 2 });
  await expect(groups).toHaveText(["Du", "Mitteilungen", `Gruppe „${GROUP_ID}“`, "Darstellung", "Konto", "Hilfe", "Gefahrenzone"]);
  // Aktiver Tab „Einstellungen“
  await expect(page.getByRole("link", { name: "Einstellungen" })).toHaveAttribute("aria-current", "page");

  // Hilfe = dieselben Einträge wie das „?“-Sheet, Tutorial zuerst.
  const help = page.getByRole("main").getByRole("button", { name: /^(Tutorial ansehen|Was ist neu|Häufige Fragen|Feedback geben)/ });
  await expect(help.first()).toContainText("Tutorial ansehen");

  // Kontrast in Tab-Leiste, Header und Einstellungen: dunkel (Seed) und hell.
  const dark = await seriousA11yViolations(page);
  await setDarkMode(false);
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  const light = await seriousA11yViolations(page);
  await setDarkMode(true);
  console.log([formatA11y("settings dunkel", dark), formatA11y("settings hell", light)].join("\n"));
  expect(dark.filter((v) => v.id === "color-contrast")).toEqual([]);
  expect(light.filter((v) => v.id === "color-contrast")).toEqual([]);
});

test("Passwort ändern öffnet ein Sheet und meldet ein falsches Passwort", async ({ page }) => {
  await loginAs(page, "Anna");
  await page.goto("/settings");
  await page.getByRole("button", { name: /Passwort ändern/ }).click();

  const sheet = page.getByRole("dialog", { name: "Passwort ändern" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel("Aktuelles Passwort")).toBeFocused();
  await expect(sheet.getByRole("button", { name: "Ändern" })).toBeDisabled();

  await sheet.getByLabel("Aktuelles Passwort").fill("falsch");
  await sheet.getByLabel("Neues Passwort").fill("neu12345");
  await sheet.getByRole("button", { name: "Ändern" }).click();
  await expect(page.getByText("Aktuelles Passwort falsch")).toBeVisible();
  await expect(sheet).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("Identität wechseln über das IdentitySheet", async ({ page }) => {
  await loginAs(page, "Anna");
  await page.goto("/settings");
  await page.getByRole("button", { name: /Anna.*Ändern/ }).click();

  const sheet = page.getByRole("dialog", { name: "Wer bist du?" });
  await sheet.getByRole("button", { name: /Max/ }).click();
  await sheet.getByRole("button", { name: "Ja, das bin ich" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Du bist jetzt Max")).toBeVisible();
  await expect(page.getByRole("button", { name: /Max.*Ändern/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mein Profil (Max)" })).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), `gm:identity:v1:${GROUP_ID}`)).toBe("max");
});

test("„Wo mache ich mit?“ zeigt die Teilnahmen als Schalter", async ({ page }) => {
  await loginAs(page, "Anna");
  await page.goto("/settings");
  // Seed: Anna macht bei Christof, Ben und Lena mit (nicht bei Max und Sophie).
  const row = page.getByRole("button", { name: /Wo mache ich mit\?/ });
  await expect(row).toContainText("Bei 3 von 5 Personen dabei");
  await row.click();

  const sheet = page.getByRole("dialog", { name: "Wo mache ich mit?" });
  await expect(sheet.getByRole("switch", { name: "Bei Ben mitmachen" })).toHaveAttribute("aria-checked", "true");
  await expect(sheet.getByRole("switch", { name: "Bei Max mitmachen" })).toHaveAttribute("aria-checked", "false");
  await expect(sheet.getByRole("switch", { name: "Bei Anna mitmachen" })).toHaveCount(0);
});

test("Feedback-Platzhalter fragt nach der App, nicht nach Wünschen (UX-11)", async ({ page }) => {
  await loginAs(page, "Ben");
  await page.goto("/feedback");
  await expect(page.getByPlaceholder("Was fehlt dir in der App? Was nervt?")).toBeVisible();
  await expect(page.getByPlaceholder(/Was wünschst du dir/)).toHaveCount(0);
});
