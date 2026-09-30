// Alle Screens für Sichtprüfung (e2e/emu-shots.mjs) und axe-Scan
// (e2e/tests/a11y.spec.ts) an EINER Stelle. Jede Szene stellt ihre Daten
// selbst her (Admin-SDK gegen den Emulator) und ruft an jedem prüfbaren
// Zustand `s.snap(id, titel, optionen)` auf. Was snap tut, entscheidet der
// Aufrufer: Screenshot oder axe-Scan.
//
// Themenblöcke = Kontaktbögen: abstimmung, spoiler, wunschliste, tutorial, home.

import { GROUP_ID, getDb, seed, setDarkMode } from "./emu-seed.mjs";
import { currentUid, login, openSession, settle } from "./emu-session.mjs";


const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Themenblöcke in Reihenfolge (Schlüssel = Präfix der Kontaktbögen). */
export const BLOCKS = [
  { key: "abstimmung", title: "Abstimmung" },
  { key: "spoiler", title: "Spoiler-Schutz & Identität" },
  { key: "wunschliste", title: "Wunschliste" },
  { key: "tutorial", title: "Tutorial & Hilfe" },
  { key: "home", title: "Home & Einstellungen" },
];

export const THEMES = [
  { key: "light", suffix: "hell" },
  { key: "dark", suffix: "dunkel" },
];

// ── Testdaten ────────────────────────────────────────────

const pollDoc = (id) => getDb().doc(`groups/${GROUP_ID}/polls/${id}`);
const wishDoc = (id) => getDb().doc(`groups/${GROUP_ID}/wishlist/${id}`);

/**
 * Zusatzdaten über den Seed hinaus: „notiert von Ben“, ein Herzenswunsch und
 * Christofs überreichtes Geschenk vom Vorjahr (eine gewählte, eine nicht
 * gewählte Idee) für den Spoiler-Fall „für dich“.
 */
async function prepareExtras() {
  const db = getDb();
  const now = Date.now();
  await db.doc(`groups/${GROUP_ID}/gifts/christof_vorjahr`).set({
    personId: "christof",
    year: new Date().getFullYear() - 1,
    status: "received",
    budgetPerPerson: 20,
    manuallyAdded: true,
    stackOrder: 0,
    enteredStackAt: now - 400 * DAY,
    receivedAt: now - 357 * DAY,
    participantIds: ["anna", "ben"],
    selectedSuggestionIds: ["s-cv-1"],
  });
  for (const [id, title, price, chosen] of [
    ["s-cv-1", "Vinyl-Box „Abbey Road“", 120, true],
    ["s-cv-2", "Sushi-Kochkurs", 90, false],
  ]) {
    await db.doc(`groups/${GROUP_ID}/suggestions/${id}`).set({
      giftId: "christof_vorjahr",
      title,
      price,
      suggestedBy: "anna",
      createdAt: now - 380 * DAY,
      ...(chosen ? { paidBy: "ben" } : {}),
    });
  }
  await wishDoc("w-anna-3").set({
    personId: "anna",
    title: "Kinogutschein für zwei",
    price: 25,
    note: "am liebsten fürs Programmkino",
    addedBy: "ben",
    createdAt: Date.now() - 3 * DAY,
  });
  await wishDoc("w-anna-2").update({ favorite: true });
}

/** Neue, beendete Runde auf Christofs Geschenk (jede Runde öffnet ihr Ergebnis neu). */
let round = 0;
function closedChristofPoll(g, votes) {
  const startedAt = Date.now() - 3 * DAY + ++round * 60_000;
  return pollDoc(g.christof).set({
    giftId: g.christof,
    status: "closed",
    startedAt,
    startedBy: "ben",
    endsAt: startedAt + 48 * HOUR,
    closedAt: startedAt + 30 * HOUR,
    closedBy: "ben",
    closedReason: "manual",
    votes,
  });
}

// ── Szenen ───────────────────────────────────────────────
// ctx: welcher Browser-Kontext (siehe openSession). themes: nur diese Themes.

export const SCENES = [
  // ─── Abstimmung ───
  {
    block: "abstimmung",
    ctx: "main",
    async run(s) {
      await pollDoc(s.g.christof).delete();
      await s.as("ben");
      await s.open(`/gift/${s.g.christof}`, "Ideen gesammelt");
      await s.snap("101-abstimmung-ideenphase", "Ideen-Phase (Ben)");
      await s.page.getByRole("region", { name: "Jetzt" }).getByRole("button", { name: "Abstimmung starten" }).click();
      await s.dialog("Abstimmung starten");
      await s.snap("102-abstimmung-startsheet", "Start-Sheet", { mode: "viewport" });
    },
  },
  {
    block: "abstimmung",
    ctx: "main",
    async run(s) {
      await s.as("ben");
      await s.open(`/gift/${s.g.anna}?vote=1`);
      await s.dialog("Abstimmung · für Anna");
      await s.snap("103-abstimmung-votesheet-ohne-stimme", "VoteSheet ohne Stimme (Ben)", { mode: "viewport" });
      await s.as("lena");
      await s.open(`/gift/${s.g.anna}?vote=1`);
      await s.dialog("Abstimmung · für Anna");
      await s.snap("104-abstimmung-votesheet-mit-stimmen", "VoteSheet mit 2 Stimmen (Lena)", { mode: "viewport" });
    },
  },
  {
    block: "abstimmung",
    ctx: "main",
    async run(s) {
      await s.as("christof"); // hat gewählt → kein automatisches VoteSheet
      await s.open(`/gift/${s.g.anna}`, "Abstimmung läuft");
      await s.snap("105-abstimmung-laeuft", "Abstimmung läuft (Christof)");
      const ideas = s.page.getByRole("region", { name: /^Ideen/ });
      await ideas.scrollIntoViewIfNeeded();
      await s.snap("106-abstimmung-ideen-gesperrt", "Gesperrte Ideen-Karten", { element: ideas });
      await s.page.locator('[title="Link teilen"]').first().click();
      await s.dialog();
      await s.snap("107-abstimmung-link-teilen", "Link teilen", { mode: "viewport" });
    },
  },
  {
    block: "abstimmung",
    ctx: "main",
    async run(s) {
      await s.as("sophie");
      await s.open(`/gift/${s.g.anna}`, "noch nicht mit");
      await s.snap("108-abstimmung-nicht-teilnehmerin", "Nicht-Teilnehmerin (Sophie)");
    },
  },
  {
    block: "abstimmung",
    ctx: "main",
    async run(s) {
      await s.as("anna");
      await closedChristofPoll(s.g, {
        anna: ["s-christof-1"],
        ben: ["s-christof-1", "s-christof-2"],
        max: ["s-christof-3"],
        sophie: ["s-christof-1"],
      });
      // Das Ergebnis öffnet einmal von selbst → „Später“, dann die Seite.
      await s.open(`/gift/${s.g.christof}`);
      const result = s.page.getByRole("dialog", { name: "Ergebnis · für Christof" });
      await result.waitFor();
      await result.getByRole("button", { name: "Später" }).click();
      await result.waitFor({ state: "hidden" });
      await s.settleAndWait();
      await s.snap("109-abstimmung-auswertung", "Auswertung, Entscheidung offen (Anna)");

      await closedChristofPoll(s.g, { anna: ["s-christof-1"], ben: ["s-christof-1", "s-christof-2"], max: ["s-christof-3"] });
      await s.open(`/gift/${s.g.christof}?vote=1`);
      await s.dialog("Ergebnis · für Christof");
      await s.snap("110-abstimmung-ergebnis-sieger", "Ergebnis mit Sieger", { mode: "viewport" });

      await closedChristofPoll(s.g, { anna: ["s-christof-1"], ben: ["s-christof-2"] });
      await s.open(`/gift/${s.g.christof}?vote=1`);
      await s.dialog("Ergebnis · für Christof");
      await s.snap("111-abstimmung-ergebnis-gleichstand", "Ergebnis Gleichstand", { mode: "viewport" });
    },
  },
  {
    block: "abstimmung",
    ctx: "main",
    async run(s) {
      await s.as("anna");
      await s.open(`/gift/${s.g.lena}`, "Yogamatte");
      await s.snap("112-abstimmung-entschieden", "Entschieden (Lena-Geschenk)");
      await s.open(`/gift/${s.g.maxPast}`, "Tamper");
      await s.snap("113-abstimmung-erhalten", "Erhalten (Max, Vorjahr)");
    },
  },

  // ─── Spoiler-Schutz & Identität ───
  {
    block: "spoiler",
    ctx: "main",
    async run(s) {
      await s.as("christof");
      await s.open("/", "Als Nächstes hast du Geburtstag");
      await s.snap("201-spoiler-home-beschenkter", "Home als Beschenkter (Christof)");
      await s.open(`/gift/${s.g.christof}`, "Deine Überraschung");
      await s.snap("202-spoiler-ueberraschung", "Überraschungs-Ansicht");
      await s.open("/wishlist", "Kopfhörer");
      await s.snap("203-spoiler-wunschliste-banner", "Eigene Wunschliste mit Banner");
      await s.open("/person/christof");
      await s.page.getByRole("tab", { name: "Geschenke", exact: true }).click();
      await s.settleAndWait();
      await s.snap("204-spoiler-profil-geschenke", "Eigenes Profil → Geschenke");
      await s.open("/past", "für dich");
      await s.snap("205-spoiler-alte-geschenke", "Alte Geschenke („für dich“)");
      await s.page.getByRole("button", { name: /Christof/ }).click();
      await s.page.getByRole("heading", { name: "Dein Geschenk", exact: true }).waitFor();
      await s.settleAndWait();
      await s.snap("206-spoiler-dein-geschenk", "Überreicht: nur gewählte Titel");
    },
  },
  {
    block: "spoiler",
    ctx: "noIdentity",
    async run(s) {
      await s.open("/", "Christof");
      await s.snap("207-identitaet-home-ohne", "Home ohne Identität");
      await s.open(`/gift/${s.g.anna}`);
      const sheet = await s.dialog("Wer bist du?");
      await s.snap("208-identitaet-sheet", "IdentitySheet (Geburtstagskind)", { mode: "viewport" });
      await sheet.getByRole("button", { name: /Ben/ }).click();
      await sheet.getByRole("button", { name: "Ja, das bin ich" }).waitFor();
      await s.settleAndWait();
      await s.snap("209-identitaet-bestaetigen", "„Du bist Ben?“", { mode: "viewport" });
    },
  },

  // ─── Wunschliste ───
  {
    block: "wunschliste",
    ctx: "main",
    async run(s) {
      await s.as("anna");
      await s.open("/wishlist", "Kinogutschein");
      await s.snap("301-wunschliste-eigene", "Eigene Liste mit „notiert von Ben“ (Anna)");
      await s.page.getByRole("button", { name: "Mit Link, Preis oder Notiz" }).click();
      const sheet = await s.dialog("Neuer Wunsch");
      await sheet.getByLabel("Was?").fill("Fahrradklingel Retro");
      await sheet.getByLabel("Link", { exact: true }).fill("amazon.de/klingel");
      await sheet.getByLabel("Preis ca. (€)").fill("19,99");
      await sheet.getByLabel("Notiz").fill("in Messing");
      await s.settleAndWait();
      await s.snap("302-wunschliste-wishsheet", "WishSheet „Neuer Wunsch“", { mode: "viewport" });
      await s.page.keyboard.press("Escape");
      await sheet.waitFor({ state: "hidden" });

      await s.as("ben");
      await s.open("/person/anna", "Kinogutschein");
      await s.snap("303-wunschliste-fremde", "Annas Liste aus Bens Sicht");
    },
  },
  {
    block: "wunschliste",
    ctx: "main",
    async run(s) {
      await s.as("christof");
      await s.open(`/gift/${s.g.anna}`, "Abstimmung läuft");
      await s.page.getByRole("button", { name: /Wunschliste von Anna/ }).click();
      await s.dialog("Wunschliste von Anna");
      await s.snap("304-wunschliste-uebernehmen-gesperrt", "Übernehmen gesperrt (Abstimmung)", { mode: "viewport" });

      await s.as("anna");
      await s.open(`/gift/${s.g.ben}`, "Espresso");
      await s.page.getByRole("button", { name: /Wunschliste von Ben/ }).click();
      await s.dialog("Wunschliste von Ben");
      await s.snap("305-wunschliste-uebernehmen", "Wünsche übernehmen (Anna → Ben)", { mode: "viewport" });
    },
  },
  {
    block: "wunschliste",
    ctx: "main",
    async run(s) {
      await wishDoc("w-anna-1").update({ createdAt: Date.now() - 400 * DAY });
      await wishDoc("w-anna-2").update({ fulfilledAt: Date.now() - 10 * DAY, fulfilledGiftId: "anna_alt" });
      await s.as("anna");
      await s.open("/wishlist", "Kinogutschein");
      await s.page.getByText(/^Älter als 12 Monate \(1\)/).click();
      await s.page.getByText(/^Bekommen \(1\)/).click();
      await s.settleAndWait();
      await s.snap("306-wunschliste-aelter-bekommen", "„Älter als 12 Monate“ und „Bekommen“");
    },
  },

  // ─── Tutorial & Hilfe ───
  {
    block: "tutorial",
    ctx: "main",
    async run(s) {
      await s.as("anna");
      const titles = [
        "Geschenke gemeinsam planen",
        "Kein Geburtstag verpasst",
        "Wünsche und Ideen",
        "Gemeinsam abstimmen",
        "Keine Spoiler für dich",
        "Hol dir die App",
      ];
      await s.open("/tutorial");
      await s.page.getByRole("region", { name: "Tutorial" }).waitFor();
      for (const [i, title] of titles.entries()) {
        await s.page.getByRole("button", { name: `Seite ${i + 1}: ${title}` }).click();
        await s.page.locator("p[aria-live]").filter({ hasText: `Seite ${i + 1} von` }).waitFor();
        await s.settleAndWait(700); // Scroll-Snap setzt sich
        await s.snap(`40${i + 1}-tutorial-seite-${i + 1}`, `Tutorial ${i + 1}: ${title}`, { mode: "viewport" });
      }
    },
  },
  {
    block: "tutorial",
    ctx: "main",
    async run(s) {
      await s.as("anna");
      await s.open("/", "Christof");
      await s.page.getByRole("button", { name: /^Hilfe/ }).click();
      await s.dialog("Hilfe");
      await s.snap("407-hilfe-sheet", "Hilfe-Sheet „?“", { mode: "viewport" });
      await s.open("/whats-new", "Was ist neu");
      await s.snap("408-was-ist-neu", "Was ist neu");
      await s.open("/help", "Häufige Fragen");
      await s.snap("409-haeufige-fragen", "Häufige Fragen");
    },
  },
  {
    block: "tutorial",
    ctx: "firstRun",
    async run(s) {
      await login(s.page);
      await s.page.waitForURL(/\/tutorial$/);
      await s.page.getByRole("region", { name: "Tutorial" }).waitFor();
      await s.page.getByRole("button", { name: "Überspringen" }).click();
      await s.dialog("Wer bist du?");
      await s.snap("410-erster-start-wer-bist-du", "Erster Start: „Wer bist du?“", { mode: "viewport" });
    },
  },

  // ─── Home & Einstellungen ───
  {
    block: "home",
    ctx: "main",
    async run(s) {
      await s.as("ben");
      await s.open("/", "Du fehlst");
      await s.snap("501-home-phasen", "Home mit Phasenzeilen (Ben)");
      await s.page.getByRole("button", { name: "Mehr zu Christof" }).click();
      await s.dialog("Geschenk für Christof");
      await s.snap("502-home-menue-aussetzen", "⋯-Menü „Diesmal aussetzen“", { mode: "viewport" });
    },
  },
  {
    block: "home",
    ctx: "main",
    async run(s) {
      await s.as("anna");
      await s.open("/settings", "Gefahrenzone");
      await s.snap("503-einstellungen", "Einstellungen (ganze Seite)");
      await s.page.getByRole("button", { name: /Passwort ändern/ }).click();
      await s.dialog("Passwort ändern");
      await s.snap("504-einstellungen-passwort", "Passwort-Sheet", { mode: "viewport" });

      // Mitteilungen aktiv: Berechtigung + registrierter Token für diese UID
      // (ohne FCM – der Merker in localStorage reicht für den Gerät-Status).
      const uid = await currentUid(s.page);
      if (!uid) throw new Error("UID nicht gefunden");
      await s.context.addInitScript(() => {
        window.__gmNotifyPermission = "granted";
      });
      await getDb().doc(`groups/${GROUP_ID}/members/${uid}`).set({ notifyStack: true, notifyPolls: true }, { merge: true });
      await s.page.evaluate(
        (u) => localStorage.setItem("gm:push-token", JSON.stringify({ token: "demo-token", uid: u, syncedAt: Date.now() })),
        uid,
      );
      await s.open("/settings", "✓ aktiv");
      const block = s.page.locator("section", { has: s.page.getByRole("heading", { name: "Mitteilungen" }) });
      await s.snap("505-einstellungen-mitteilungen", "Mitteilungen aktiv", { element: block });
    },
  },
  {
    block: "home",
    ctx: "main",
    async run(s) {
      await s.as("anna");
      await s.open("/people", "Sophie");
      await s.snap("506-personen", "Personen");
      await s.open("/person/ben", "JBL");
      await s.snap("507-person-ben-wunschliste", "Person Ben → Wunschliste");
      await s.page.getByRole("tab", { name: "Geschenke", exact: true }).click();
      await s.settleAndWait();
      await s.snap("508-person-ben-geschenke", "Person Ben → Geschenke");
      await s.open("/past", "Max");
      await s.snap("509-alte-geschenke", "Alte Geschenke (Anna)");
      await s.open("/feedback", "Feedback");
      await s.snap("510-feedback", "Feedback");
    },
  },
  {
    block: "home",
    ctx: "loggedOut",
    themes: ["dark"], // ohne Gruppe gilt immer das dunkle Default-Theme
    async run(s) {
      await s.page.goto("/login");
      await s.page.getByPlaceholder("Gruppen-ID").waitFor();
      await s.settleAndWait();
      await s.snap("511-login", "Login");
    },
  },
];

/**
 * Seedet, stellt das Theme ein und spielt alle Szenen durch. `snap` bekommt
 * { page, id, title, block, theme, mode, element }. Fehler einer Szene gehen an
 * `onError` (Standard: werfen).
 */
/**
 * @param {{
 *   browser: import("playwright").Browser,
 *   baseURL: string | undefined,
 *   theme: { key: string, suffix: string },
 *   snap: (s: { page: import("playwright").Page, id: string, title: string, block: string, theme: { key: string, suffix: string }, mode: string, element?: import("playwright").Locator }) => Promise<void>,
 *   onPage?: (page: import("playwright").Page, kind: string) => void,
 *   onError?: (err: Error, scene: { block: string }) => void,
 *   only?: (scene: { block: string }) => boolean,
 * }} options
 */
export async function runScenes({ browser, baseURL, theme, snap, onPage, onError, only }) {
  const { giftIds } = await seed();
  await prepareExtras();
  await setDarkMode(theme.key === "dark");

  const sessions = new Map();
  const sessionFor = async (kind) => {
    if (kind === "firstRun") return openSession(browser, baseURL, kind, onPage); // jedes Mal frisch
    if (!sessions.has(kind)) sessions.set(kind, await openSession(browser, baseURL, kind, onPage));
    return sessions.get(kind);
  };

  try {
    for (const scene of SCENES) {
      if (scene.themes && !scene.themes.includes(theme.key)) continue;
      if (only && !only(scene)) continue;
      const { page, context } = await sessionFor(scene.ctx);
      const s = {
        page,
        context,
        g: giftIds,
        theme,
        async as(personId) {
          await page.evaluate(([g, p]) => localStorage.setItem(`gm:identity:v1:${g}`, p), [GROUP_ID, personId]);
        },
        async open(route, waitText) {
          await page.goto(route);
          await page.getByText("Lade Gruppendaten…").waitFor({ state: "detached", timeout: 30_000 }).catch(() => {});
          if (waitText) await page.getByText(waitText, { exact: false }).filter({ visible: true }).first().waitFor();
          await s.settleAndWait();
        },
        async dialog(name) {
          const d = name ? page.getByRole("dialog", { name }) : page.getByRole("dialog").last();
          await d.waitFor();
          await s.settleAndWait();
          return d;
        },
        async settleAndWait(ms = 500) {
          await settle(page);
          await wait(ms);
        },
        snap: async (id, title, opts = {}) => {
          await page.mouse.move(0, 0); // kein Hover-Rest vom letzten Klick
          await snap({
            page,
            id: `${id}-${theme.suffix}`,
            title,
            block: scene.block,
            theme,
            mode: opts.mode ?? "page",
            element: opts.element,
          });
        },
      };
      try {
        await scene.run(s);
      } catch (err) {
        if (onError) onError(err, scene);
        else throw err;
      } finally {
        if (scene.ctx === "firstRun") await context.close();
      }
    }
  } finally {
    for (const { context } of sessions.values()) await context.close().catch(() => {});
  }
}
