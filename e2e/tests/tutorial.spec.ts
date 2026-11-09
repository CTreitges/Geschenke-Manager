import { expect, test, type Locator, type Page } from "@playwright/test";
import { GROUP_ID, GROUP_PASSWORD, seed } from "../emu-seed.mjs";
import { ONBOARDING_KEYS, TUTORIAL_VERSION, dayStamp } from "../../src/lib/onboarding";
import { CURRENT_VERSION } from "../../src/lib/patchnotes";
import { formatA11y, loginAs, personId, seriousA11yViolations } from "./helpers";

// Hilfe-Menü „?“, grafisches Tutorial und First-Run (Spec §1 Tutorial/Hilfe,
// gesamtbild A5). Reduzierte Bewegung: Seitenwechsel ohne Smooth-Scroll,
// damit Live-Region und Punkte sofort den Endstand zeigen.
test.use({ contextOptions: { reducedMotion: "reduce" } });

// Frischer Seed pro Test: andere Specs ändern Identitäten und Geschenke.
let giftIds: Record<string, string>;
test.beforeEach(async () => {
  ({ giftIds } = await seed());
});

const isHome = (u: URL) => u.pathname === "/";

const helpButton = (page: Page) => page.getByRole("button", { name: /^Hilfe/ });
const liveRegion = (page: Page) => page.locator("p[aria-live]");

/** Zur letzten Seite springen – erst wenn der Pager steht (der Tasten-Listener hängt im Effekt). */
async function jumpToLastPage(page: Page) {
  await expect(liveRegion(page)).toHaveText(/^Seite 1 von \d/);
  await page.keyboard.press("End");
  await expect(page.getByRole("button", { name: "Los geht's" })).toBeVisible();
}

/** Titel der Einträge im Hilfe-Sheet in Anzeige-Reihenfolge (ohne „Schließen“). */
async function helpEntryTitles(page: Page): Promise<string[]> {
  const sheet = page.getByRole("dialog", { name: "Hilfe" });
  await expect(sheet).toBeVisible();
  const names = await sheet
    .getByRole("button")
    .evaluateAll((els) => els.map((e) => (e.getAttribute("aria-label") ?? e.textContent ?? "").trim()));
  return names.filter((n) => n !== "Schließen");
}

const identitySheet = (page: Page) => page.getByRole("dialog", { name: "Wer bist du?" });

/**
 * OnboardingFlow entscheidet, sobald die Personen geladen sind. `loaded` ist
 * etwas, das erst mit den Personen erscheint (z. B. „Hallo, Ben“). Danach
 * einen Frame abwarten (Effekte sind durch) und die URL im Browser lesen –
 * so braucht die Negativ-Erwartung kein festes Zeitfenster.
 */
async function expectStaysOn(page: Page, pathname: string, loaded: Locator) {
  await expect(loaded).toBeVisible();
  const path = await page.evaluate(
    () => new Promise<string>((resolve) => requestAnimationFrame(() => setTimeout(() => resolve(location.pathname)))),
  );
  expect(path).toBe(pathname);
}

test("Hilfe-Sheet: Tutorial zuerst, Neu-Punkt verschwindet nach „Was ist neu“", async ({ page }, testInfo) => {
  await loginAs(page, "Ben");
  await expect(page.getByRole("heading", { name: /Hallo, Ben/ })).toBeVisible();

  // Bestandsnutzer ohne gesehene Version → Neu-Punkt (Label nennt die Version).
  await expect(helpButton(page)).toHaveAccessibleName(`Hilfe – neu in ${CURRENT_VERSION}`);
  await expect(helpButton(page)).toHaveAttribute("aria-haspopup", "dialog");

  await helpButton(page).click();
  const titles = await helpEntryTitles(page);
  expect(titles[0]).toMatch(/^Tutorial ansehen/);
  expect(titles[1]).toMatch(/^Was ist neu/);
  expect(titles[2]).toMatch(/^Häufige Fragen/);
  expect(titles[3]).toMatch(/^Feedback geben/);
  // Im Browser (nicht installiert) steht „App installieren“ am Ende.
  expect(titles[4]).toMatch(/^App installieren/);
  expect(titles).toHaveLength(5);
  const sheet = page.getByRole("dialog", { name: "Hilfe" });
  await expect(sheet.getByText("neu", { exact: true })).toBeVisible();
  const sheetA11y = await seriousA11yViolations(page);

  await sheet.getByRole("button", { name: /^Was ist neu/ }).click();
  await page.waitForURL(/\/whats-new$/);
  await expect(page.getByRole("heading", { name: "Was ist neu" })).toBeVisible();
  await expect(page.getByText(CURRENT_VERSION).first()).toBeVisible();
  const whatsNewA11y = await seriousA11yViolations(page);

  // Punkt weg – sofort (Event) und nach Neuladen (gespeichert).
  await expect(helpButton(page)).toHaveAccessibleName("Hilfe");
  await page.reload();
  await expect(helpButton(page)).toHaveAccessibleName("Hilfe");
  await helpButton(page).click();
  await expect(page.getByRole("dialog", { name: "Hilfe" }).getByText("neu", { exact: true })).toHaveCount(0);

  // Häufige Fragen: native <details>, Spoiler-Schutz-Frage vorhanden.
  await page.getByRole("dialog", { name: "Hilfe" }).getByRole("button", { name: /^Häufige Fragen/ }).click();
  await page.waitForURL(/\/help$/);
  await page.getByText("Warum soll ich „Wer bist du?“ festlegen?").click();
  await expect(page.getByText(/Spoiler-Schutz greift/)).toBeVisible();
  const faqA11y = await seriousA11yViolations(page);

  const log = [
    formatA11y("hilfe-sheet (Ben)", sheetA11y),
    formatA11y("whats-new (Ben)", whatsNewA11y),
    formatA11y("help/faq (Ben)", faqA11y),
  ].join("\n");
  console.log(log);
  await testInfo.attach("axe-hilfe.txt", { body: log, contentType: "text/plain" });
});

test("Tutorial-Pager: Weiter, Punkte, Tastatur, Überspringen", async ({ page }, testInfo) => {
  await loginAs(page, "Ben");
  await helpButton(page).click();
  await page.getByRole("dialog", { name: "Hilfe" }).getByRole("button", { name: /^Tutorial ansehen/ }).click();
  await page.waitForURL(/\/tutorial$/);

  // Außerhalb von Layout: kein Header mit „?“.
  await expect(helpButton(page)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Tutorial" })).toBeVisible();
  const pages = page.locator('section[aria-roledescription="Seite"]');
  const count = await pages.count();
  // 5 Seiten + Seite 6 „Hol dir die App“ (im Browser, nie installiert).
  expect(count).toBe(6);
  await expect(liveRegion(page)).toHaveText(`Seite 1 von ${count}: Geschenke gemeinsam planen`);
  // Nur die aktive Seite ist bedienbar.
  await expect(page.locator('section[aria-roledescription="Seite"][inert]')).toHaveCount(count - 1);
  const tutorialA11y = await seriousA11yViolations(page);
  // Der Pager selbst ist per Tastatur erreichbar (Kontraste der Tab-Leiste gibt es hier nicht).
  expect(tutorialA11y.map((v) => v.id)).not.toContain("scrollable-region-focusable");

  // Knopf „Weiter“
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(liveRegion(page)).toHaveText(`Seite 2 von ${count}: Kein Geburtstag verpasst`);
  await expect(page.getByRole("button", { name: "Seite 2: Kein Geburtstag verpasst" })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page.getByText(`2/${count}`)).toBeVisible();

  // Tastatur: →, ←, End, Home
  await page.keyboard.press("ArrowRight");
  await expect(liveRegion(page)).toHaveText(`Seite 3 von ${count}: Wünsche und Ideen`);
  await page.keyboard.press("ArrowLeft");
  await expect(liveRegion(page)).toHaveText(`Seite 2 von ${count}: Kein Geburtstag verpasst`);
  await page.keyboard.press("End");
  await expect(liveRegion(page)).toHaveText(`Seite ${count} von ${count}: Hol dir die App`);
  // Letzte Seite: kein „Überspringen“, primär „Los geht's“.
  await expect(page.getByRole("button", { name: "Überspringen" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Los geht's" })).toBeVisible();
  await page.keyboard.press("Home");
  await expect(liveRegion(page)).toHaveText(`Seite 1 von ${count}: Geschenke gemeinsam planen`);

  // Punkt direkt anspringen
  await page.getByRole("button", { name: "Seite 4: Gemeinsam abstimmen" }).click();
  await expect(liveRegion(page)).toHaveText(`Seite 4 von ${count}: Gemeinsam abstimmen`);
  await expect(page.getByRole("img", { name: /Abstimmungsfenster/ })).toBeVisible();

  // Esc = Überspringen → zurück, wo das Tutorial geöffnet wurde.
  await page.keyboard.press("Escape");
  await page.waitForURL(isHome);
  await expect(page.getByRole("heading", { name: /Hallo, Ben/ })).toBeVisible();

  // Erneut öffnen und über den Knopf „Überspringen“ verlassen.
  await helpButton(page).click();
  await page.getByRole("dialog", { name: "Hilfe" }).getByRole("button", { name: /^Tutorial ansehen/ }).click();
  await page.waitForURL(/\/tutorial$/);
  await page.getByRole("button", { name: "Überspringen" }).click();
  await page.waitForURL(isHome);

  const log = formatA11y("tutorial (Ben)", tutorialA11y);
  console.log(log);
  await testInfo.attach("axe-tutorial.txt", { body: log, contentType: "text/plain" });
});

test("First-Run: neues Tutorial erscheint genau einmal, danach kein Neu-Punkt", async ({ page }) => {
  // Ohne Onboarding-Keys = neues Gerät. Identität (Ben) setzt loginAs.
  await loginAs(page, "Ben", { keys: {} });
  await page.waitForURL(/\/tutorial$/);
  await expect(liveRegion(page)).toHaveText(/^Seite 1 von \d: Geschenke gemeinsam planen$/);

  // Das Gesehen-Flag wird erst beim Verlassen gesetzt.
  expect(await page.evaluate((k) => localStorage.getItem(k), ONBOARDING_KEYS.tutorial)).toBeNull();
  await page.getByRole("button", { name: "Überspringen" }).click();
  await page.waitForURL(isHome);
  await expect(page.getByRole("heading", { name: /Hallo, Ben/ })).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), ONBOARDING_KEYS.tutorial)).toBe(TUTORIAL_VERSION);
  // Neu-Nutzer sieht keinen Neu-Punkt für die ganze Versionshistorie.
  await expect(helpButton(page)).toHaveAccessibleName("Hilfe");

  // Neuer App-Start (neuer Tab = neue Sitzung): kein Tutorial mehr.
  const next = await page.context().newPage();
  await next.goto("/");
  await expectStaysOn(next, "/", next.getByRole("heading", { name: /Hallo, Ben/ }));
  await next.close();
});

test("Bestandsnutzer (Alt-Key v5): neues Tutorial einmal, Neu-Punkt bleibt", async ({ page }) => {
  await loginAs(page, "Anna", { keys: { "gm:tutorial-seen:v5": "yes", [ONBOARDING_KEYS.installTip]: "yes" } });
  // Alt-Keys zählen NICHT als gesehen (Spec §1 Tutorial).
  await page.waitForURL(/\/tutorial$/);
  await jumpToLastPage(page);
  await page.getByRole("button", { name: "Los geht's" }).click();
  await page.waitForURL(isHome);
  await expect(page.getByRole("heading", { name: /Hallo, Anna/ })).toBeVisible();
  // Bestandsnutzer: „Was ist neu“ bleibt markiert.
  await expect(helpButton(page)).toHaveAccessibleName(`Hilfe – neu in ${CURRENT_VERSION}`);

  const next = await page.context().newPage();
  await next.goto("/");
  await expectStaysOn(next, "/", next.getByRole("heading", { name: /Hallo, Anna/ }));
  await next.close();
});

test("First-Run ohne Identität: nach dem Tutorial fragt „Wer bist du?“, „Später“ merkt es sich", async ({ page }) => {
  await loginAs(page, null, { keys: { [ONBOARDING_KEYS.installTip]: "yes" } });
  await page.waitForURL(/\/tutorial$/);
  await page.getByRole("button", { name: "Überspringen" }).click();
  await page.waitForURL(isHome);

  // Direkt danach (noch derselbe Schritt) das IdentitySheet.
  const sheet = identitySheet(page);
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Später" }).click();
  await expect(sheet).toBeHidden();
  expect(new URL(page.url()).pathname).toBe("/");
  expect(await page.evaluate((k) => localStorage.getItem(k), ONBOARDING_KEYS.identityAsked)).toBe(dayStamp());
  // Der Header-Chip bleibt als Weg zur Auswahl.
  await expect(page.getByRole("button", { name: "Wer bist du?" })).toBeVisible();

  // Neuer App-Start: weder Tutorial noch erneute Frage.
  const next = await page.context().newPage();
  await next.goto("/");
  await expectStaysOn(next, "/", next.getByRole("button", { name: /Christof/ }).first());
  await expect(identitySheet(next)).toHaveCount(0);
  await next.close();
});

test("First-Run ohne Identität: Auswahl im Sheet setzt „Wer bin ich?“", async ({ page }) => {
  await loginAs(page, null, { keys: { [ONBOARDING_KEYS.installTip]: "yes" } });
  await page.waitForURL(/\/tutorial$/);
  await jumpToLastPage(page);
  await page.getByRole("button", { name: "Los geht's" }).click();
  await page.waitForURL(isHome);

  const sheet = identitySheet(page);
  await sheet.getByRole("button", { name: /Ben/ }).click();
  await sheet.getByRole("button", { name: "Ja, das bin ich" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("heading", { name: /Hallo, Ben/ })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
  expect(await page.evaluate((k) => localStorage.getItem(k), `gm:identity:v1:${GROUP_ID}`)).toBe(personId("Ben"));
});

test("Share-Link-Einstieg: kein Tutorial in dieser Sitzung, erst beim nächsten Start", async ({ page }) => {
  const annaGift = giftIds.anna;
  await page.context().addInitScript(
    ({ key, id }) => localStorage.setItem(key, id),
    { key: `gm:identity:v1:${GROUP_ID}`, id: personId("Ben") },
  );

  await page.goto(`/g/${GROUP_ID}/gift/${annaGift}`);
  await page.getByPlaceholder("Gruppenpasswort").fill(GROUP_PASSWORD);
  await page.locator('form button[type="submit"]').click();
  // Ben hat noch nicht gewählt → das VoteSheet darf sich öffnen (?vote=1).
  await page.waitForURL(new RegExp(`/gift/${annaGift}(\\?vote=1)?$`), { timeout: 60_000 });
  await expectStaysOn(page, `/gift/${annaGift}`, page.getByRole("heading", { name: "Anna · Geburtstag" }));

  // Auch auf der Übersicht keine Unterbrechung in dieser Sitzung.
  await page.goto("/");
  await expectStaysOn(page, "/", page.getByRole("heading", { name: /Hallo, Ben/ }));

  // Nächster App-Start (neuer Tab): jetzt kommt das Tutorial.
  const next = await page.context().newPage();
  await next.goto("/");
  await next.waitForURL(/\/tutorial$/);
  await expect(next.getByRole("region", { name: "Tutorial" })).toBeVisible();
  await next.close();
});
