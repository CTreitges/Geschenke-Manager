import crypto from "node:crypto";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { GROUP_ID, GROUP_PASSWORD, getDb, seed, setDarkMode } from "../emu-seed.mjs";
import { SUPPRESS_KEYS, formatA11y, loginAs, seriousA11yViolations } from "./helpers";

// Spoiler-Schutz + Identität mit zwei Browser-Kontexten: Christof ist die
// beschenkte Person (Geburtstag in 8 Tagen, 3 Ideen, beendete Abstimmung),
// Anna plant mit. Zusätzlich ein überreichtes Christof-Geschenk vom Vorjahr
// (eine ausgewählte, eine nicht gewählte Idee).

const DAY = 86_400_000;
const CHRISTOF_IDEAS = ["Plattenspieler", "Whisky-Tasting", "Fahrrad-Werkzeugset"];
const PAST_ID = "christof_past";
const PAST_CHOSEN = "Vinyl-Box „Abbey Road“";
const PAST_NOT_CHOSEN = "Sushi-Kochkurs";
let giftIds: Record<string, string>;

test.beforeEach(async () => {
  ({ giftIds } = await seed());
  const db = getDb();
  const now = Date.now();
  const lastYear = new Date().getFullYear() - 1;
  await db.doc(`groups/${GROUP_ID}/gifts/${PAST_ID}`).set({
    personId: "christof",
    year: lastYear,
    status: "received",
    budgetPerPerson: 20,
    manuallyAdded: true,
    stackOrder: 0,
    enteredStackAt: now - 400 * DAY,
    receivedAt: now - 357 * DAY,
    participantIds: ["anna", "ben"],
    selectedSuggestionIds: ["s-cp-1"],
  });
  for (const [id, title, price, selected] of [
    ["s-cp-1", PAST_CHOSEN, 120, true],
    ["s-cp-2", PAST_NOT_CHOSEN, 90, false],
  ] as const) {
    await db.doc(`groups/${GROUP_ID}/suggestions/${id}`).set({
      giftId: PAST_ID,
      title,
      price,
      suggestedBy: "anna",
      createdAt: now - 380 * DAY,
      ...(selected ? { paidBy: "ben" } : {}),
    });
  }
});

/** Zweiter Browser-Kontext mit denselben Einstellungen wie die Projekt-Konfiguration. */
async function newPage(browser: Browser, testInfo: TestInfo): Promise<Page> {
  const { baseURL, viewport, locale } = testInfo.project.use;
  const context = await browser.newContext({ baseURL, viewport, locale });
  return context.newPage();
}

/** Anmelden ohne „Wer bin ich?“ (Onboarding-Tipps bleiben unterdrückt). */
async function loginWithoutIdentity(page: Page): Promise<void> {
  await page.context().addInitScript((keys) => {
    for (const [k, v] of Object.entries(keys)) localStorage.setItem(k, v);
  }, SUPPRESS_KEYS);
  await page.goto("/login");
  await page.getByPlaceholder("Gruppen-ID").fill(GROUP_ID);
  await page.getByPlaceholder("Passwort").fill(GROUP_PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  await page.getByText("Lade Gruppendaten…").waitFor({ state: "detached", timeout: 30_000 });
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

/** Kein Ideen-Titel, kein Betrag und keine Namen der Planenden im Seiteninhalt. */
async function expectNoSpoiler(page: Page, where: string) {
  const text = await page.locator("main").innerText();
  for (const t of [...CHRISTOF_IDEAS, PAST_NOT_CHOSEN]) expect(text, `${where}: Idee „${t}“`).not.toContain(t);
  for (const name of ["Anna", "Ben", "Max", "Sophie"]) expect(text, `${where}: Name ${name}`).not.toContain(name);
}

const birthdayIn8Days = () => {
  const d = new Date(Date.now() + 8 * DAY);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
};

test("Christof sieht von seinem Geschenk nichts, Anna sieht alles", async ({ page, browser }, testInfo) => {
  const axeLog: string[] = [];
  const christofGift = giftIds.christof;

  // ── Christof (beschenkte Person) ───────────────────────
  await loginAs(page, "Christof");
  const hero = page.getByRole("button", { name: /Als Nächstes hast du Geburtstag!/ });
  await expect(hero).toContainText("Wunschliste pflegen");
  const ownCard = page.getByRole("button", { name: /Du · / });
  await expect(ownCard).toContainText("Überraschung läuft");
  await expect(ownCard).not.toContainText("€");
  for (const t of CHRISTOF_IDEAS) await expect(page.locator("main")).not.toContainText(t);
  await shots(page, testInfo, "01-home-christof");

  await hero.click();
  await expect(page).toHaveURL(/\/wishlist$/);
  await expect(page.getByRole("status")).toContainText(
    `Für deinen Geburtstag am ${birthdayIn8Days()} wird schon geplant – ergänze gern Wünsche.`,
  );
  await expect(page.getByText("Profil →")).toHaveCount(0);
  await expectNoSpoiler(page, "/wishlist");
  await shots(page, testInfo, "02-wishlist-banner");

  // Geschenk direkt und per Push-Deeplink: nur die Überraschungs-Ansicht, kein Sheet.
  await page.goto(`/gift/${christofGift}?vote=1`);
  await expect(page.getByRole("heading", { name: "Deine Überraschung" })).toBeVisible();
  await expect(page.getByText("Psst … hier entsteht eine Überraschung!")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectNoSpoiler(page, "/gift (Christof)");
  await expect(page.locator("main")).not.toContainText("€");
  axeLog.push(formatA11y("SurpriseScreen (Christof)", await seriousA11yViolations(page)));
  await shots(page, testInfo, "03-surprise-screen");

  // Eigenes Profil: Überraschung ohne Zahlen, Status, Löschen oder „Neues Geschenk“.
  await page.goto("/person/christof");
  await expect(page.locator("main")).toContainText("Überraschung läuft");
  await page.getByRole("button", { name: "Geschenke", exact: true }).click();
  await expect(page.locator("main")).toContainText("Überraschung in Planung");
  await expect(page.getByRole("button", { name: /Neues Geschenk anlegen/ })).toHaveCount(0);
  await expect(page.locator("main")).toContainText("Geschenke für dich legen deine Freunde an.");
  await expect(page.locator("main")).not.toContainText("Personen ·");
  await expectNoSpoiler(page, "/person/christof");
  await shots(page, testInfo, "04-person-self-gifts");

  // Alte Geschenke: eigenes ohne Betrag, Max' Geschenk (nicht meins) mit.
  await page.goto("/past");
  const ownPast = page.getByRole("button", { name: /Christof/ });
  await expect(ownPast).toContainText("für dich");
  await expect(ownPast).not.toContainText("€");
  await expect(page.getByRole("button", { name: /Max/ })).toContainText("85 €");
  await shots(page, testInfo, "05-past-gifts");

  // Nach der Übergabe: nur Titel der ausgewählten Ideen.
  await ownPast.click();
  await expect(page.getByRole("heading", { name: "Dein Geschenk", exact: true })).toBeVisible();
  await expect(page.locator("main")).toContainText(PAST_CHOSEN);
  await expectNoSpoiler(page, "/gift/past (Christof)");
  await expect(page.locator("main")).not.toContainText("€");
  await shots(page, testInfo, "06-handed-over");

  // ── Anna (plant mit) sieht alles ───────────────────────
  const anna = await newPage(browser, testInfo);
  await loginAs(anna, "Anna");
  const christofCard = anna.getByRole("button", { name: /^Christof\b/ });
  await expect(christofCard).toBeVisible();
  await anna.goto(`/gift/${christofGift}`);
  await expect(anna.getByRole("heading", { name: "Christof · Geburtstag" })).toBeVisible();
  for (const t of CHRISTOF_IDEAS) await expect(anna.locator("main")).toContainText(t);
  await anna.goto("/past");
  await expect(anna.getByRole("button", { name: /Christof/ })).toContainText("€");
  await anna.context().close();

  const log = axeLog.join("\n");
  console.log(log);
  await testInfo.attach("axe-serious-critical.txt", { body: log, contentType: "text/plain" });
});

test("Ohne Identität: Gate vor dem Geschenk, Auswahl mit Bestätigung", async ({ page }, testInfo) => {
  const giftId = giftIds.anna;
  await loginWithoutIdentity(page);
  await expect(page.getByRole("button", { name: "Wer bist du?" })).toBeVisible();
  await shots(page, testInfo, "09-home-no-identity-chip");

  await page.goto(`/gift/${giftId}`);
  const sheet = page.getByRole("dialog", { name: "Wer bist du?" });
  await expect(sheet).toBeVisible();
  // Kein Geschenk-Inhalt hinter dem Sheet.
  await expect(page.getByText("Picknickdecke")).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: /Anna/ })).toContainText("🎂 Geburtstagskind");
  await expect(sheet.getByRole("button", { name: /Lena/ })).toContainText("schon vergeben");
  await expect(sheet).toContainText("„schon vergeben“: Jemand hat sich auf einem anderen Gerät");
  await expect(sheet.getByRole("button", { name: "Ich bin nicht dabei, nur ansehen" })).toBeVisible();
  console.log(formatA11y("IdentitySheet", await seriousA11yViolations(page)));
  await shots(page, testInfo, "07-identity-sheet");

  await sheet.getByRole("button", { name: /Ben/ }).click();
  await expect(sheet).toContainText("Du bist Ben?");
  await expect(sheet).toContainText("Dann blenden wir Geschenkideen für Ben vor dir aus.");
  await shots(page, testInfo, "08-identity-confirm");
  await sheet.getByRole("button", { name: "Ja, das bin ich" }).click();

  // Danach läuft es weiter: Geschenk sichtbar, Ben hat noch nicht gewählt → VoteSheet.
  await expect(page.getByRole("dialog", { name: "Abstimmung · für Anna" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Anna · Geburtstag" })).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), `gm:identity:v1:${GROUP_ID}`)).toBe("ben");
  await expect.poll(async () => {
    const members = await getDb().collection(`groups/${GROUP_ID}/members`).get();
    return members.docs.map((d) => d.get("identityPersonId")).filter((x) => x === "ben").length;
  }).toBe(1);
});

test("„Nur ansehen“ gilt für die Sitzung; Idee teilen fragt erst nach dem Namen", async ({ page }, testInfo) => {
  const giftId = giftIds.christof;
  await getDb().doc(`groups/${GROUP_ID}/polls/${giftId}`).delete(); // Ideen-Phase
  await loginWithoutIdentity(page);
  await page.goto(`/gift/${giftId}`);
  const sheet = page.getByRole("dialog", { name: "Wer bist du?" });
  await sheet.getByRole("button", { name: "Ich bin nicht dabei, nur ansehen" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("heading", { name: "Christof · Geburtstag" })).toBeVisible();
  await page.reload();
  await shots(page, testInfo, "10-view-only-no-identity");
  await expect(page.getByRole("heading", { name: "Christof · Geburtstag" })).toBeVisible();
  await expect(sheet).toBeHidden();

  // Gesperrte Aktion ohne Identität → Sheet, danach wird die Idee gespeichert.
  await page.getByPlaceholder("Idee teilen…").fill("Hängematte");
  await page.getByRole("button", { name: "Teilen", exact: true }).click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: /Max/ }).click();
  await sheet.getByRole("button", { name: "Ja, das bin ich" }).click();
  await expect(page.getByText("Hängematte")).toBeVisible();
  await expect
    .poll(async () => {
      const snap = await getDb().collection(`groups/${GROUP_ID}/suggestions`).where("title", "==", "Hängematte").get();
      return snap.docs.map((d) => d.get("suggestedBy"));
    })
    .toEqual(["max"]);
});

test("Neu dabei: Person im IdentitySheet anlegen (Einstellungen)", async ({ page }, testInfo) => {
  await loginWithoutIdentity(page);
  await page.getByRole("link", { name: "Wunschliste" }).click();
  await expect(page.getByRole("button", { name: "Ich wähle mich aus" })).toBeVisible();
  await shots(page, testInfo, "11-wishlist-no-identity");

  await page.getByRole("link", { name: "Einstellungen" }).click();
  const block = page.getByRole("button", { name: /Noch nicht gewählt/ });
  await expect(page.getByText("Deine Wahl schützt auch vor Spoilern: Geschenke für dich siehst du nicht.")).toBeVisible();
  await shots(page, testInfo, "12-settings-identity");
  await block.click();

  const sheet = page.getByRole("dialog", { name: "Wer bist du?" });
  await sheet.getByRole("button", { name: "Ich bin noch nicht dabei → Person anlegen" }).click();
  await sheet.getByLabel("Dein Name").fill("Paula");
  await sheet.locator("select").first().selectOption("3");
  await sheet.locator("select").nth(1).selectOption("5");
  await shots(page, testInfo, "13-identity-create");
  await sheet.getByRole("button", { name: "Anlegen" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Du bist jetzt Paula")).toBeVisible();
  await expect(page.getByRole("button", { name: /Paula/ }).first()).toBeVisible();

  const snap = await getDb().collection(`groups/${GROUP_ID}/persons`).where("name", "==", "Paula").get();
  expect(snap.docs.map((d) => d.get("birthday"))).toEqual(["05-03"]);
  expect(await page.evaluate((k) => localStorage.getItem(k), `gm:identity:v1:${GROUP_ID}`)).toBe(snap.docs[0].id);
});

test("Geschenk-Link als Christof: Anmelden, sich selbst wählen → Wunschliste", async ({ browser }, testInfo) => {
  const page = await newPage(browser, testInfo);
  await page.context().addInitScript((keys) => {
    for (const [k, v] of Object.entries(keys)) localStorage.setItem(k, v);
  }, SUPPRESS_KEYS);
  const giftId = giftIds.christof;
  await page.goto(`/g/${GROUP_ID}/gift/${giftId}?vote=1`);
  await page.getByPlaceholder("Gruppenpasswort").fill(GROUP_PASSWORD);
  await page.getByRole("button", { name: "Einloggen & Geschenk ansehen" }).click();

  // Parameter bleibt erhalten, das Gate fragt vor jedem Inhalt.
  await expect(page).toHaveURL(new RegExp(`/gift/${giftId}\\?vote=1$`), { timeout: 60_000 });
  const sheet = page.getByRole("dialog", { name: "Wer bist du?" });
  await expect(sheet).toBeVisible();
  for (const t of CHRISTOF_IDEAS) await expect(page.getByText(t)).toHaveCount(0);
  await sheet.getByRole("button", { name: /Christof/ }).click();
  await sheet.getByRole("button", { name: "Ja, das bin ich" }).click();
  await expect(page.getByText("Psst, das ist deine Überraschung 🤫")).toBeVisible();
  await expect(page).toHaveURL(/\/wishlist$/);
  await expectNoSpoiler(page, "/wishlist nach Share-Link");

  // Später mit gesetzter Identität: derselbe Link zeigt direkt die Überraschung.
  await page.goto(`/g/${GROUP_ID}/gift/${giftId}?vote=1`);
  await expect(page.getByRole("heading", { name: "Deine Überraschung" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.context().close();
});

test("Geschenk-Link reicht ?vote=1 bis zum VoteSheet durch", async ({ page }) => {
  await loginAs(page, "Christof"); // hat bei Anna schon gewählt → kein Auto-Öffnen
  await page.goto(`/g/${GROUP_ID}/gift/${giftIds.anna}?vote=1`);
  await expect(page.getByRole("dialog", { name: "Abstimmung · für Anna" })).toBeVisible();
});

test("Magic-Link landet in der Wunschliste, ohne Tutorial", async ({ browser }, testInfo) => {
  const token = crypto.randomBytes(32).toString("hex");
  await getDb().doc(`magic_tokens/${token}`).set({ groupId: GROUP_ID, personId: "christof", expiresAt: Date.now() + DAY });
  const page = await newPage(browser, testInfo); // bewusst ohne Onboarding-Keys
  await page.goto(`/m/${token}`);
  await expect(page).toHaveURL(/\/wishlist$/, { timeout: 60_000 });
  await expect(page.getByRole("status")).toContainText("wird schon geplant");

  await page.getByRole("link", { name: "Übersicht" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: /Als Nächstes hast du Geburtstag!/ })).toBeVisible();
  await expect(page).not.toHaveURL(/tutorial/);
  await page.context().close();
});
