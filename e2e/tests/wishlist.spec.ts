import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { GROUP_ID, getDb, seed, setDarkMode } from "../emu-seed.mjs";
import { formatA11y, loginAs, seriousA11yViolations } from "./helpers";

// Wunschliste neu: anlegen/bearbeiten im WishSheet, Herzenswunsch, Löschen
// mit Rückgängig, „notiert von …“ für alle (auch die Besitzerin), Übernahme
// im Geschenk und Sperre während der Abstimmung. Seed: Anna hat 2 Wünsche,
// w-anna-1 ist schon als Idee s-anna-1 übernommen; Annas Geschenk hat eine
// laufende Abstimmung (Christof hat gewählt).

const DAY = 86_400_000;
let giftIds: Record<string, string>;

test.beforeEach(async () => {
  ({ giftIds } = await seed());
});

const wishDoc = (id: string) => getDb().doc(`groups/${GROUP_ID}/wishlist/${id}`);

async function wishesOf(personId: string) {
  const snap = await getDb().collection(`groups/${GROUP_ID}/wishlist`).where("personId", "==", personId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown> & { id: string });
}

/** Zweiter Browser-Kontext mit denselben Einstellungen wie die Projekt-Konfiguration. */
async function newPage(browser: Browser, testInfo: TestInfo): Promise<Page> {
  const { baseURL, viewport, locale } = testInfo.project.use;
  const context = await browser.newContext({ baseURL, viewport, locale });
  return context.newPage();
}

/** Screenshot hell + dunkel nach test-results/…/<name>-{dark,light}.png (Sichtprüfung). */
async function shots(page: Page, testInfo: TestInfo, name: string) {
  for (const dark of [true, false]) {
    await setDarkMode(dark);
    await expect(page.locator("html")).toHaveClass(dark ? /dark/ : /^(?!.*dark)/);
    await page.screenshot({ path: testInfo.outputPath(`${name}-${dark ? "dark" : "light"}.png`), animations: "disabled" });
  }
  await setDarkMode(true);
}

const card = (page: Page, title: string | RegExp) => page.getByRole("button", { name: title });

test("Anna pflegt ihre Liste: anlegen, bearbeiten, Herzenswunsch, löschen + Rückgängig", async ({ page }, testInfo) => {
  const axeLog: string[] = [];
  await loginAs(page, "Anna");
  await page.goto("/wishlist");
  await expect(page.getByRole("heading", { name: "Meine Wunschliste" })).toBeVisible();
  // Spoiler-Schutz: w-anna-1 steckt als Idee in Annas Geschenk – Anna sieht das nicht.
  await expect(card(page, /Keramik-Workshop/)).toBeVisible();
  await expect(page.locator("main")).not.toContainText("übernommen");

  // Neu mit Link und Preis: „19,99“ und „amazon.de/x“.
  await page.getByRole("button", { name: "Mit Link, Preis oder Notiz" }).click();
  const sheet = page.getByRole("dialog", { name: "Neuer Wunsch" });
  await sheet.getByLabel("Was?").fill("Fahrradklingel Retro");
  await sheet.getByLabel("Link", { exact: true }).fill("amazon.de/x");
  await expect(sheet.getByText("↗ amazon.de")).toBeVisible();
  await sheet.getByLabel("Preis ca. (€)").fill("19,99");
  await sheet.getByLabel("Notiz").fill("in Messing");
  axeLog.push(formatA11y("WishSheet neu (Anna)", await seriousA11yViolations(page)));
  await shots(page, testInfo, "02-wishsheet");
  await sheet.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(sheet).toBeHidden();

  const bell = card(page, /Fahrradklingel Retro/);
  await expect(bell).toContainText("ca. 19,99 €");
  await expect(bell).toContainText("↗ amazon.de");
  await expect(bell).toContainText("„in Messing“");
  await expect(page.getByRole("link", { name: /Fahrradklingel Retro.*ansehen/ })).toHaveAttribute("href", "https://amazon.de/x");
  const created = (await wishesOf("anna")).find((w) => w.title === "Fahrradklingel Retro")!;
  expect(created).toMatchObject({ price: 19.99, url: "https://amazon.de/x", note: "in Messing", addedBy: "anna" });

  // Bearbeiten: Preis leeren (Feld verschwindet wirklich, B26) + Herzenswunsch.
  await bell.click();
  const edit = page.getByRole("dialog", { name: "Wunsch bearbeiten" });
  await expect(edit.getByLabel("Preis ca. (€)")).toHaveValue("19,99");
  await edit.getByLabel("Preis ca. (€)").fill("");
  await edit.getByRole("switch", { name: "⭐ Herzenswunsch" }).click();
  await edit.getByRole("button", { name: "Speichern" }).click();
  await expect(edit).toBeHidden();
  const favorites = page.locator("section", { hasText: "⭐ Herzenswünsche" });
  await expect(favorites.getByRole("button", { name: /Fahrradklingel Retro/ })).toBeVisible();
  await expect(bell).not.toContainText("€");
  await expect
    .poll(async () => {
      const w = (await wishDoc(created.id).get()).data()!;
      return { price: "price" in w, favorite: w.favorite, updated: typeof w.updatedAt };
    })
    .toEqual({ price: false, favorite: true, updated: "number" });
  axeLog.push(formatA11y("Meine Wunschliste (Anna)", await seriousA11yViolations(page)));
  await shots(page, testInfo, "01-eigene-liste");

  // Löschen im Sheet → Toast „Rückgängig“ stellt ihn mit derselben ID wieder her.
  await bell.click();
  await page.getByRole("dialog", { name: "Wunsch bearbeiten" }).getByRole("button", { name: "Löschen" }).click();
  await expect(bell).toHaveCount(0);
  await expect.poll(async () => (await wishDoc(created.id).get()).exists).toBe(false);
  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(bell).toBeVisible();
  await expect.poll(async () => (await wishDoc(created.id).get()).data()?.favorite).toBe(true);
  // Das Archiv (archiveGroupDocChange) hat Änderung und Löschung mitgeschrieben.
  await expect
    .poll(
      async () => {
        const snap = await getDb().collection(`groups/${GROUP_ID}/_archive`).where("docId", "==", created.id).get();
        return snap.docs.map((d) => d.get("op")).sort();
      },
      { timeout: 30_000 },
    )
    .toEqual(["delete", "update"]);

  const log = axeLog.join("\n");
  console.log(log);
  await testInfo.attach("axe-serious-critical.txt", { body: log, contentType: "text/plain" });
});

test("Älter als 12 Monate und Bekommen: „Noch aktuell ✓“ und „Wieder auf die Liste“", async ({ page }, testInfo) => {
  const now = Date.now();
  await wishDoc("w-anna-1").update({ createdAt: now - 400 * DAY });
  await wishDoc("w-anna-2").update({ fulfilledAt: now - 10 * DAY, fulfilledGiftId: "anna_old" });
  await loginAs(page, "Anna");
  await page.goto("/wishlist");

  await page.getByText("Älter als 12 Monate (1) – noch aktuell?").click();
  await page.getByText("Bekommen (1)").click();
  await expect(card(page, /Moleskine/)).toContainText(`bekommen ${new Date(now - 10 * DAY).getFullYear()}`);
  await shots(page, testInfo, "07-aelter-bekommen");

  await page.getByRole("button", { name: "Noch aktuell ✓" }).click();
  await expect(page.getByText(/Älter als 12 Monate/)).toHaveCount(0);
  await expect.poll(async () => typeof (await wishDoc("w-anna-1").get()).data()?.updatedAt).toBe("number");

  await page.getByRole("button", { name: "Wieder auf die Liste" }).click();
  await expect(page.getByText(/Bekommen \(/)).toHaveCount(0);
  await expect(card(page, /Moleskine/)).not.toContainText("bekommen");
  await expect
    .poll(async () => {
      const w = (await wishDoc("w-anna-2").get()).data()!;
      return ["fulfilledAt", "fulfilledGiftId"].filter((k) => k in w);
    })
    .toEqual([]);
});

test("Ben notiert auf Annas Liste – „notiert von Ben“ sieht auch Anna", async ({ page, browser }, testInfo) => {
  await loginAs(page, "Ben");
  await page.goto("/person/anna");
  await page.getByLabel("Wunsch von Anna notieren").fill("Kinogutschein");
  await page.getByRole("button", { name: "Wunsch hinzufügen" }).click();
  await expect(card(page, /Kinogutschein/)).toContainText("notiert von dir");
  // Andere sehen, dass w-anna-1 schon in Annas Geschenk übernommen ist.
  await expect(card(page, /Keramik-Workshop/)).toContainText(`übernommen · Geburtstag ${giftIds.anna.split("_")[1]}`);
  await expect.poll(async () => (await wishesOf("anna")).find((w) => w.title === "Kinogutschein")?.addedBy).toBe("ben");
  await shots(page, testInfo, "03-fremde-liste");

  const anna = await newPage(browser, testInfo);
  await loginAs(anna, "Anna");
  await anna.goto("/wishlist");
  await expect(card(anna, /Kinogutschein/)).toContainText("notiert von Ben");
  await expect(anna.locator("main")).not.toContainText("übernommen");
  await shots(anna, testInfo, "04-eigene-liste-notiert-von-ben");

  // Leerzustand fremd: Lena hat keine Wünsche.
  await page.goto("/person/lena");
  await expect(page.getByText("Lena hat noch nichts eingetragen")).toBeVisible();
  await anna.context().close();
});

test("Übernahme im Geschenk – gesperrt, solange die Abstimmung läuft", async ({ page }, testInfo) => {
  const axeLog: string[] = [];
  const giftId = giftIds.anna;
  await loginAs(page, "Christof"); // hat schon gewählt → kein Auto-Öffnen des VoteSheets
  await page.goto(`/gift/${giftId}`);
  await expect(page.getByRole("heading", { name: "Anna · Geburtstag" })).toBeVisible();

  const strip = page.getByRole("button", { name: /Wunschliste von Anna/ });
  await expect(strip).toContainText("2 Wünsche · 1 übernommen · während der Abstimmung gesperrt");
  await shots(page, testInfo, "05-geschenk-streifen-gesperrt");
  await strip.click();
  const sheet = page.getByRole("dialog", { name: "Wunschliste von Anna" });
  await expect(sheet).toContainText("Übernehmen geht wieder, sobald die Abstimmung endet.");
  await expect(sheet.getByRole("button", { name: "„Moleskine Notizbuch A5, dunkelgrün“ übernehmen" })).toBeDisabled();
  await expect(sheet.getByText("übernommen", { exact: true })).toBeVisible();
  await shots(page, testInfo, "06-adoptsheet-gesperrt");
  await sheet.getByRole("button", { name: "Schließen" }).click();
  await expect(sheet).toBeHidden();

  // Abstimmung weg → Übernehmen geht (live über den Snapshot).
  await getDb().doc(`groups/${GROUP_ID}/polls/${giftId}`).delete();
  await expect(strip).not.toContainText("gesperrt");
  await expect(strip).toContainText("2 Wünsche · 1 übernommen");
  await strip.click();
  await sheet.getByRole("button", { name: "„Moleskine Notizbuch A5, dunkelgrün“ übernehmen" }).click();
  await expect(page.getByText("Übernommen", { exact: true })).toBeVisible();
  await expect(sheet.getByText("übernommen", { exact: true })).toHaveCount(2);
  axeLog.push(formatA11y("WishAdoptSheet (Christof)", await seriousA11yViolations(page)));
  await shots(page, testInfo, "08-adoptsheet");

  const sid = `wish_${giftId}_w-anna-2`;
  await expect
    .poll(async () => (await getDb().doc(`groups/${GROUP_ID}/suggestions/${sid}`).get()).data())
    .toMatchObject({ giftId, suggestedBy: "christof", fromWishItemId: "w-anna-2", price: 22 });

  await sheet.getByRole("button", { name: "Schließen" }).click();
  await expect(strip).toContainText("2 Wünsche · 2 übernommen");
  const ideas = page.getByRole("region", { name: /^Ideen/ });
  await expect(ideas).toContainText("Moleskine Notizbuch A5, dunkelgrün");
  await expect(ideas).toContainText("🎁 Wunschliste");

  const log = axeLog.join("\n");
  console.log(log);
  await testInfo.attach("axe-serious-critical.txt", { body: log, contentType: "text/plain" });
});
