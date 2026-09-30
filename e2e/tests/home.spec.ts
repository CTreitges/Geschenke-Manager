import { expect, test, type Page } from "@playwright/test";
import { GROUP_ID, GROUP_PASSWORD, getDb, seed } from "../emu-seed.mjs";
import { SUPPRESS_KEYS, formatA11y, loginAs, personId, seriousA11yViolations } from "./helpers";

// Home: Phasenzeile je Stack-Karte, Badge „Du fehlst“ → VoteSheet,
// „Diesmal aussetzen“ im ⋯-Menü (und „Wieder aufnehmen“ über Person →
// Geschenke), Zurück nach dem Löschen und Login-Rückkehr zum Deep-Link.
// Seed (e2e/emu-seed.mjs): Christof – Abstimmung beendet, Anna – Abstimmung
// läuft (3 von 4, Ben fehlt), Ben – 1 Idee, Lena – entschieden und bezahlt.

let giftIds: Record<string, string>;

test.beforeEach(async () => {
  ({ giftIds } = await seed());
});

// Nachfolgende Specs erwarten den unveränderten Seed.
test.afterAll(async () => {
  await seed();
});

/** Hauptknopf einer Stack-Karte; sein Name beginnt mit dem Personennamen. */
const card = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}\\b`) });

test("Phasenzeilen und „Du fehlst“ öffnen das VoteSheet", async ({ page }) => {
  await loginAs(page, "Ben");
  await expect(page.getByRole("heading", { name: /Hallo, Ben/ })).toBeVisible();

  await expect(card(page, "Christof")).toContainText("🏆 Entscheidung offen");
  await expect(card(page, "Anna")).toContainText(/⏱ Abstimmung · 3\/4 · endet/);
  await expect(card(page, "Lena")).toContainText(/✓ Yogamatte Manduka PRO \+ 1 · 115/);
  // Eigene Karte (Ben ist beschenkt): nur „Überraschung läuft“, keine Phase.
  await expect(page.getByRole("button", { name: /Du · / })).toContainText("Überraschung läuft");
  await expect(page.getByRole("main")).not.toContainText("im Stack");
  // Nur bei Anna fehlt Bens Stimme, Lena ist bezahlt → genau ein Badge.
  await expect(page.getByRole("button", { name: /Du fehlst/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Bezahlung offen/ })).toHaveCount(0);
  console.log(formatA11y("home (Ben)", await seriousA11yViolations(page)));

  await page.getByRole("button", { name: /Du fehlst/ }).click();
  await expect(page).toHaveURL(new RegExp(`/gift/${giftIds.anna}\\?vote=1$`));
  await expect(page.getByRole("dialog", { name: "Abstimmung · für Anna" })).toBeVisible();
});

test("Diesmal aussetzen blendet die Karte aus, Wieder aufnehmen holt sie zurück", async ({ page }) => {
  await loginAs(page, "Anna");
  await expect(card(page, "Ben")).toContainText("💡 1 Idee");

  // Christof: Abstimmung beendet → Aussetzen erlaubt.
  await page.getByRole("button", { name: "Mehr zu Christof" }).click();
  const christofMenu = page.getByRole("dialog", { name: "Geschenk für Christof" });
  await expect(christofMenu.getByRole("button", { name: /Diesmal aussetzen/ })).toBeEnabled();
  // Automatisch angelegt → kein Löschen, nur Aussetzen.
  await expect(christofMenu.getByRole("button", { name: /Löschen/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(christofMenu).toBeHidden();

  await page.getByRole("button", { name: "Mehr zu Ben" }).click();
  await page.getByRole("dialog", { name: "Geschenk für Ben" }).getByRole("button", { name: /Diesmal aussetzen/ }).click();
  await expect(page.getByText("Ben: diesmal ausgesetzt")).toBeVisible();
  await expect(card(page, "Ben")).toHaveCount(0);
  await expect
    .poll(async () => (await getDb().doc(`groups/${GROUP_ID}/gifts/${giftIds.ben}`).get()).get("skippedAt"))
    .toEqual(expect.any(Number));

  // Neu laden: ensureAutoGift legt für dieses Jahr kein neues Geschenk an.
  await page.reload();
  await expect(card(page, "Christof")).toBeVisible();
  await expect(card(page, "Ben")).toHaveCount(0);
  const bens = await getDb().collection(`groups/${GROUP_ID}/gifts`).where("personId", "==", "ben").get();
  expect(bens.size).toBe(1);

  // Wieder aufnehmen über Personen → Ben → Geschenke.
  await page.goto(`/person/${personId("Ben")}?tab=gifts`);
  await expect(page.getByRole("tab", { name: "Geschenke" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("main")).toContainText("Diesmal ausgesetzt");
  await page.getByRole("button", { name: /^Mehr zu Geburtstag/ }).click();
  await page.getByRole("button", { name: /Wieder aufnehmen/ }).click();
  await expect(page.getByText("Ben ist wieder in der Übersicht")).toBeVisible();
  await page.getByRole("link", { name: "Übersicht" }).click();
  await expect(card(page, "Ben")).toContainText("💡 1 Idee");
});

test("Laufende Abstimmung sperrt „Diesmal aussetzen“ mit Grund", async ({ page }) => {
  await loginAs(page, "Ben");
  await page.getByRole("button", { name: "Mehr zu Anna" }).click();
  const menu = page.getByRole("dialog", { name: "Geschenk für Anna" });
  await expect(menu.getByRole("button", { name: /Diesmal aussetzen/ })).toBeDisabled();
  await expect(menu).toContainText("Erst die Abstimmung beenden");
});

test("Person löschen führt zurück, trägt sie überall aus (KOR-05)", async ({ page }) => {
  await loginAs(page, "Anna");
  await page.getByRole("link", { name: "Personen" }).click();
  await page.getByRole("button", { name: "Person hinzufügen" }).click();
  const add = page.getByRole("dialog", { name: "Person hinzufügen" });
  await add.getByLabel("Name").fill("Testperson");
  await add.locator("select").first().selectOption("3");
  await add.locator("select").nth(1).selectOption("5");
  await add.getByRole("button", { name: "Speichern" }).click();

  // Testperson macht bei Annas Geschenk mit und ist Christofs Standard-Teilnehmerin.
  const db = getDb();
  const findTest = async () =>
    (await db.collection(`groups/${GROUP_ID}/persons`).where("name", "==", "Testperson").get()).docs[0]?.id;
  await expect.poll(findTest).toBeTruthy();
  const testId = (await findTest())!;
  const annaGift = db.doc(`groups/${GROUP_ID}/gifts/${giftIds.anna}`);
  const christof = db.doc(`groups/${GROUP_ID}/persons/christof`);
  await annaGift.update({ participantIds: [...(await annaGift.get()).get("participantIds"), testId] });
  await christof.update({ defaultParticipantIds: [...((await christof.get()).get("defaultParticipantIds") ?? []), testId] });

  await page.getByRole("button", { name: /Testperson/ }).click();
  await expect(page.getByRole("heading", { name: "Testperson" })).toBeVisible();
  await page.getByRole("tab", { name: "Profil" }).click();
  await page.getByRole("button", { name: "Person löschen" }).click();
  await page.getByRole("dialog", { name: "Testperson wirklich löschen?" }).getByRole("button", { name: "Löschen" }).click();

  await expect(page).toHaveURL(/\/people$/);
  await expect(page.getByText("Testperson gelöscht")).toBeVisible();
  await expect(page.getByRole("button", { name: /Testperson/ })).toHaveCount(0);
  await expect(page.getByText("Person nicht gefunden")).toHaveCount(0);
  // Kein „Geist“: aus fremden Geschenken und Standard-Teilnehmern ausgetragen (KOR-05).
  expect((await annaGift.get()).get("participantIds")).not.toContain(testId);
  expect((await christof.get()).get("defaultParticipantIds") ?? []).not.toContain(testId);
  // Zurück landet nicht wieder auf der gelöschten Person.
  await page.goBack();
  await expect(page).not.toHaveURL(/\/person\//);
  await expect(page.getByText("Person nicht gefunden")).toHaveCount(0);
});

test("Direkt-Link ohne Login: nach dem Login zurück zum Ziel inkl. ?vote=1", async ({ page }) => {
  await page.context().addInitScript(
    ({ keys, identityKey }) => {
      for (const [k, v] of Object.entries(keys)) localStorage.setItem(k, v);
      localStorage.setItem(identityKey, "ben");
    },
    { keys: SUPPRESS_KEYS, identityKey: `gm:identity:v1:${GROUP_ID}` },
  );
  await page.goto(`/gift/${giftIds.anna}?vote=1`);
  await expect(page).toHaveURL(/\/login$/);
  await page.getByPlaceholder("Gruppen-ID").fill(GROUP_ID);
  await page.getByPlaceholder("Passwort").fill(GROUP_PASSWORD);
  await page.locator('form button[type="submit"]').click();

  await expect(page).toHaveURL(new RegExp(`/gift/${giftIds.anna}\\?vote=1$`));
  await expect(page.getByRole("dialog", { name: "Abstimmung · für Anna" })).toBeVisible();
});
