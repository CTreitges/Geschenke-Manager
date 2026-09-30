import { expect, test, type Page } from "@playwright/test";
import { GROUP_ID, getDb, seed } from "../emu-seed.mjs";
import { formatA11y, loginAs, seriousA11yViolations } from "./helpers";

// Abstimmung als PopUp (VoteSheet) mit Frist, Sperre und Entscheidungs-Sheet.
// Jeder Test startet mit frisch geseedeter Gruppe (e2e/emu-seed.mjs):
// Anna-Geschenk hat eine laufende Wahl (Christof, Lena, Max haben gewählt,
// Ben noch nicht; Sophie ist keine Teilnehmerin), Christof-Geschenk hat
// 3 Ideen und eine beendete Wahl.

const HOUR = 3_600_000;
let giftIds: Record<string, string>;

test.beforeEach(async () => {
  ({ giftIds } = await seed());
});

const pollRef = (giftId: string) => getDb().doc(`groups/${GROUP_ID}/polls/${giftId}`);
const giftRef = (giftId: string) => getDb().doc(`groups/${GROUP_ID}/gifts/${giftId}`);

async function pollData(giftId: string) {
  return (await pollRef(giftId).get()).data();
}

const voteSheet = (page: Page, name: string) => page.getByRole("dialog", { name: `Abstimmung · für ${name}` });
const resultSheet = (page: Page, name: string) => page.getByRole("dialog", { name: `Ergebnis · für ${name}` });
const nowCard = (page: Page) => page.getByRole("region", { name: "Jetzt" });

test("Teilnehmer startet, stimmt ab, beendet und legt die Entscheidung fest", async ({ page }, testInfo) => {
  const axeLog: string[] = [];
  const giftId = giftIds.christof;
  await pollRef(giftId).delete(); // Phase „Ideen“: 3 Ideen, noch keine Abstimmung
  await loginAs(page, "Ben");
  await page.goto(`/gift/${giftId}`);
  await expect(page.getByRole("heading", { name: "Christof · Geburtstag" })).toBeVisible();
  await expect(nowCard(page)).toContainText("3 Ideen gesammelt");
  await expect(page.getByRole("list", { name: "Phasen" }).locator('[aria-current="step"]')).toContainText("Ideen");

  // Start-Sheet: 48 Std ist vorausgewählt, Vorschau „endet …“.
  await nowCard(page).getByRole("button", { name: "Abstimmung starten" }).click();
  const start = page.getByRole("dialog", { name: "Abstimmung starten" });
  await expect(start.getByRole("tab", { name: "48 Std" })).toHaveAttribute("aria-selected", "true");
  await expect(start).toContainText("→ endet");
  await expect(start).toContainText("3 Ideen · 4 dürfen abstimmen");
  await start.getByRole("button", { name: "Abstimmung starten" }).click();

  // Direkt danach ist das VoteSheet offen, der Zustand steht in der URL.
  const sheet = voteSheet(page, "Christof");
  await expect(sheet).toBeVisible();
  await expect(start).toBeHidden();
  await expect(page).toHaveURL(/\?vote=1$/);
  axeLog.push(formatA11y("VoteSheet (Ben)", await seriousA11yViolations(page)));
  const started = await pollData(giftId);
  expect(started).toMatchObject({ status: "active", startedBy: "ben", votes: {} });
  expect(started!.endsAt - started!.startedAt).toBe(48 * HOUR);

  // Ganze Zeile = Umschalter; Stimmen landen atomar unter votes.ben.
  const whisky = sheet.getByRole("button", { name: /Whisky-Tasting/ });
  const tools = sheet.getByRole("button", { name: /Fahrrad-Werkzeugset/ });
  await whisky.click();
  await expect(whisky).toHaveAttribute("aria-pressed", "true");
  await tools.click();
  await expect(tools).toHaveAttribute("aria-pressed", "true");
  await tools.click();
  await expect(tools).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await pollData(giftId))?.votes?.ben).toEqual(["s-christof-2"]);

  // Schließen: ein Sammel-Toast, Sheet-Zustand aus der URL raus.
  await sheet.getByRole("button", { name: "Fertig · 1 gewählt" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Gespeichert · 1 gewählt")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/gift/${giftId}$`));

  // Sperre: keine neue Idee, kein Bearbeiten/Löschen, Hinweis statt Eingabe.
  await expect(page.getByText("Neue Ideen sind pausiert, bis die Abstimmung endet")).toBeVisible();
  await expect(page.getByPlaceholder("Idee teilen…")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Bearbeiten" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Wunschliste von Christof/ })).toContainText(
    "während der Abstimmung gesperrt",
  );
  await expect(nowCard(page)).toContainText("1 von 4");

  // Jetzt beenden (mit Rückfrage) → Ergebnis mit vorausgewähltem Sieger.
  await nowCard(page).getByRole("button", { name: "Stimmen ändern" }).click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Optionen" }).click();
  await page.getByRole("dialog", { name: "Abstimmung" }).getByRole("button", { name: "Jetzt beenden" }).click();
  const confirm = page.getByRole("dialog", { name: "1 von 4 haben gewählt – trotzdem beenden?" });
  await confirm.getByRole("button", { name: "Jetzt beenden" }).click();

  const result = resultSheet(page, "Christof");
  await expect(result).toBeVisible();
  await expect(result).toContainText("🏆 Whisky-Tasting für zwei");
  await expect(result.getByRole("button", { name: /Whisky-Tasting/ })).toHaveAttribute("aria-pressed", "true");
  await expect(result.getByRole("button", { name: /Plattenspieler/ })).toHaveAttribute("aria-pressed", "false");
  await expect(result).toContainText("Auswahl: 1 · 70 € · 17,50 € pro Person");
  axeLog.push(formatA11y("DecisionSheet (Ben)", await seriousA11yViolations(page)));

  await result.getByRole("button", { name: "Entscheidung festlegen" }).click();
  await expect(result).toBeHidden();
  await expect(nowCard(page)).toContainText("Entschieden");
  await expect(page.getByRole("list", { name: "Phasen" }).locator('[aria-current="step"]')).toContainText("Entschieden");

  await expect
    .poll(async () => (await giftRef(giftId).get()).data())
    .toMatchObject({ status: "confirmed", selectedSuggestionIds: ["s-christof-2"] });
  expect(await pollData(giftId)).toMatchObject({ status: "closed", closedReason: "manual", closedBy: "ben" });
  axeLog.push(formatA11y("Geschenk entschieden (Ben)", await seriousA11yViolations(page)));

  // axe vorerst nur protokollieren (wie smoke.spec.ts), nicht failen.
  const log = axeLog.join("\n");
  console.log(log);
  await testInfo.attach("axe-serious-critical.txt", { body: log, contentType: "text/plain" });
});

test("Gleichstand: Ergebnis öffnet einmal von selbst, ohne Vorauswahl, „Beide nehmen“", async ({ page }) => {
  const giftId = giftIds.christof;
  const now = Date.now();
  await pollRef(giftId).set({
    giftId,
    status: "closed",
    startedAt: now - 2 * 24 * HOUR,
    startedBy: "anna",
    endsAt: now - HOUR,
    closedAt: now - HOUR,
    closedReason: "timeout",
    votes: { anna: ["s-christof-1"], max: ["s-christof-2"] },
  });
  await loginAs(page, "Ben");
  await page.goto(`/gift/${giftId}`);

  const result = resultSheet(page, "Christof");
  await expect(result).toBeVisible();
  await expect(result).toContainText("⚖ Gleichstand");
  await expect(result).toContainText("(Zeit abgelaufen)");
  await expect(result).not.toContainText("🏆");
  for (const row of await result.getByRole("button", { pressed: true }).all()) {
    throw new Error(`Unerwartet vorausgewählt: ${await row.textContent()}`);
  }
  await result.getByRole("button", { name: "Beide nehmen" }).click();
  await expect(result.getByRole("button", { name: /Plattenspieler/ })).toHaveAttribute("aria-pressed", "true");
  await expect(result.getByRole("button", { name: /Whisky-Tasting/ })).toHaveAttribute("aria-pressed", "true");
  await expect(result).toContainText("Auswahl: 2 · 219 €");

  // „Später“ schließt; beim nächsten Besuch öffnet es nicht nochmal von selbst.
  await result.getByRole("button", { name: "Später" }).click();
  await expect(result).toBeHidden();
  await page.reload();
  await expect(nowCard(page)).toContainText("Gleichstand");
  await expect(result).toBeHidden();
});

test("Deep-Link ?vote=1 öffnet das VoteSheet, Zurück schließt es", async ({ page }) => {
  const giftId = giftIds.anna;
  await loginAs(page, "Christof"); // hat schon abgestimmt → kein automatisches Öffnen
  await page.goto(`/gift/${giftId}`);
  await expect(nowCard(page)).toContainText("Abstimmung läuft");
  await expect(voteSheet(page, "Anna")).toBeHidden();

  await page.goto(`/gift/${giftId}?vote=1`);
  const sheet = voteSheet(page, "Anna");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: /Keramik-Workshop/ })).toHaveAttribute("aria-pressed", "true");
  await expect(sheet).toContainText("3 von 4 · Es fehlt: Ben");

  await page.goBack();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/gift/${giftId}$`));
  await expect(page.getByRole("heading", { name: "Anna · Geburtstag" })).toBeVisible();
});

test("Wer noch nicht abgestimmt hat, bekommt das VoteSheet einmal pro Runde von selbst", async ({ page }) => {
  const giftId = giftIds.anna;
  await loginAs(page, "Ben");
  await page.goto(`/gift/${giftId}`);
  const sheet = voteSheet(page, "Anna");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Schließen" }).click();
  await expect(sheet).toBeHidden();
  await expect(nowCard(page)).toContainText("Du hast noch nicht abgestimmt · gestartet von Lena");

  await page.reload();
  await expect(nowCard(page)).toContainText("Abstimmung läuft");
  await expect(sheet).toBeHidden();
});

test("Nicht-Teilnehmerin sieht die Wahl nur lesend und kann mitmachen", async ({ page }) => {
  const giftId = giftIds.anna;
  await loginAs(page, "Sophie");
  await page.goto(`/gift/${giftId}`);
  await expect(nowCard(page)).toContainText("Du machst bei diesem Geschenk noch nicht mit");
  await expect(voteSheet(page, "Anna")).toBeHidden();
  await expect(page.getByRole("button", { name: "Bearbeiten" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /zur Abstimmung/ })).toHaveCount(0);

  await nowCard(page).getByRole("button", { name: "Mitmachen & abstimmen" }).click();
  const sheet = voteSheet(page, "Anna");
  await expect(sheet).toBeVisible();
  const picnic = sheet.getByRole("button", { name: /Picknickdecke/ });
  await picnic.click();
  await expect(picnic).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await giftRef(giftId).get()).data()?.participantIds).toContain("sophie");
  await expect.poll(async () => (await pollData(giftId))?.votes?.sophie).toEqual(["s-anna-2"]);
});
