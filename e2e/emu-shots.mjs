// Screenshots der App gegen die LOKALEN Firebase-Emulatoren (demo-geschenke).
// Startet selbst nur den Vite-Dev-Server (Mode "emulator"), NICHT die
// Emulatoren — dafür `npm run emu:shots` (firebase emulators:exec) nutzen.
// Erwartet eine per e2e/emu-seed.mjs befüllte Gruppe "demo".

import { spawn } from "node:child_process";
import { mkdirSync, openSync, readSync, closeSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { chromium } from "playwright";
import { GROUP_ID, GROUP_PASSWORD, getDb, setDarkMode } from "./emu-seed.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT_DIR =
  process.env.EMU_SHOTS_DIR ?? path.join(ROOT, "e2e", ".shots");
const PORT = 5174;
const BASE = `http://127.0.0.1:${PORT}`;
const MAX_WIDTH = 1200;

// Onboarding (Tutorial, Identität, Install-Tipp) unterdrücken – Keys wie in
// src/lib/onboarding.ts (ONBOARDING_KEYS, TUTORIAL_VERSION).
const SUPPRESS_KEYS = {
  "gm:onboarding:tutorial": "6",
  "gm:onboarding:identity-asked": "yes",
  "gm:pwa-install-tip-seen:v1": "yes",
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Vite-Dev-Server als Kindprozess ──────────────────────
function startVite() {
  const viteBin = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(
    process.execPath,
    // --config explizit: ein veraltetes, gitignoriertes vite.config.js (tsc-Artefakt)
    // hätte sonst Vorrang vor vite.config.ts (dort fehlt z. B. __BUILD_TIME__).
    [
      viteBin,
      "--config", "vite.config.ts",
      "--mode", "emulator",
      "--port", String(PORT),
      "--strictPort",
      "--host", "127.0.0.1",
    ],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  child.getLog = () => log;
  return child;
}

async function waitForServer(child, timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Vite beendet (Code ${child.exitCode}):\n${child.getLog()}`);
    }
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) return;
    } catch {
      /* noch nicht erreichbar */
    }
    await wait(500);
  }
  throw new Error(`Vite nicht erreichbar nach ${timeoutMs} ms:\n${child.getLog()}`);
}

// ── PNG-Breite aus dem IHDR-Header lesen ────────────────
function pngWidth(file) {
  const fd = openSync(file, "r");
  const buf = Buffer.alloc(24);
  readSync(fd, buf, 0, 24, 0);
  closeSync(fd);
  return buf.readUInt32BE(16);
}

// ── Browser-Helfer ───────────────────────────────────────
const pageErrors = [];

async function newPage(browser, { suppress = true, label = "ctx" } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    locale: "de-DE",
  });
  if (suppress) {
    await ctx.addInitScript((kv) => {
      for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
    }, SUPPRESS_KEYS);
  }
  const page = await ctx.newPage();
  // Erster Dev-Server-Aufruf bündelt Dependencies — kann > 30 s dauern.
  page.setDefaultNavigationTimeout(120_000);
  page.setDefaultTimeout(60_000);
  page.on("pageerror", (e) => pageErrors.push(`[${label}] pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") pageErrors.push(`[${label}] console: ${m.text().slice(0, 300)}`);
  });
  return page;
}

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.getByPlaceholder("Gruppen-ID").fill(GROUP_ID);
  await page.getByPlaceholder("Passwort").fill(GROUP_PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
}

async function setIdentity(page, personId) {
  await page.evaluate(
    ([g, p]) => localStorage.setItem(`gm:identity:v1:${g}`, p),
    [GROUP_ID, personId],
  );
}

/** Navigiert, wartet auf geladene Daten (optional Text) und lässt die UI kurz setzen. */
async function open(page, route, waitText) {
  await page.goto(`${BASE}${route}`);
  await page
    .getByText("Lade Gruppendaten…")
    .waitFor({ state: "detached", timeout: 30_000 })
    .catch(() => {});
  if (waitText) {
    await page
      .getByText(waitText, { exact: false })
      .filter({ visible: true })
      .first()
      .waitFor({ timeout: 15_000 })
      .catch(() => console.warn(`[emu-shots] "${waitText}" nicht gefunden auf ${route}`));
  }
  await wait(900);
}

const shots = [];
/** Ganzseiten-Screenshot. Statt `fullPage: true` wird der Viewport auf die
 *  volle Dokumenthöhe gezogen — sonst landen fixe Elemente (Tab-Leiste, FAB,
 *  Dialog-Backdrop) mitten im Bild bei 844 px und verdecken Inhalt. */
async function shot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  for (let i = 0; i < 3; i++) {
    const h = await page.evaluate(() =>
      Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    );
    const cur = page.viewportSize().height;
    if (h <= cur && i > 0) break;
    await page.setViewportSize({ width: 390, height: Math.max(844, h) });
    await wait(300);
  }
  await page.screenshot({ path: file });
  await page.setViewportSize({ width: 390, height: 844 });
  const w = pngWidth(file);
  if (w > MAX_WIDTH) throw new Error(`${file} ist ${w}px breit (> ${MAX_WIDTH})`);
  shots.push(file);
  console.log(`[emu-shots] ${file} (${w}px)`);
}

/** Screenshot nur des Viewports (390×844) – für offene Sheets, die unten am Bildschirm kleben. */
async function sheetShot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await wait(600);
  await page.screenshot({ path: file });
  shots.push(file);
  console.log(`[emu-shots] ${file} (${pngWidth(file)}px)`);
}

/** Hilfe-Sheet über den „?“-Knopf im Header (Viewport-Shot, das Sheet klebt unten). */
async function helpShot(page, theme) {
  await open(page, "/", "Christof");
  await page.getByRole("button", { name: /^Hilfe/ }).click();
  await page.getByRole("dialog", { name: "Hilfe" }).waitFor();
  await sheetShot(page, `18-hilfe-${theme}`);
  await page.keyboard.press("Escape");
}

/** Tutorial Seite 1 und Seite 4 (Abstimmung), beides Viewport-Shots. */
async function tutorialShots(page, theme) {
  await open(page, "/tutorial");
  await sheetShot(page, `13-tutorial-${theme}`);
  await page.getByRole("button", { name: "Seite 4: Gemeinsam abstimmen" }).click();
  await page.locator("p[aria-live]").filter({ hasText: "Seite 4 von" }).waitFor();
  await wait(600); // Scroll-Snap setzt sich
  await sheetShot(page, `13b-tutorial-seite4-${theme}`);
}

/** Abstimmungs-Sheets (Start, Abstimmen, Ergebnis mit Sieger bzw. Gleichstand) in beiden Themes. */
async function pollShots(page, g) {
  const HOUR = 3_600_000;
  const pollDoc = (giftId) => getDb().doc(`groups/${GROUP_ID}/polls/${giftId}`);
  const closedPoll = (votes, startedAt) => ({
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
  let round = Date.now() - 3 * 24 * HOUR;
  for (const theme of ["dark", "light"]) {
    await setDarkMode(theme === "dark");

    // Start-Sheet: Christof-Geschenk ohne Abstimmung, als Ben
    await pollDoc(g.christof).delete();
    await setIdentity(page, "ben");
    await open(page, `/gift/${g.christof}`, "Ideen gesammelt");
    await page.getByRole("region", { name: "Jetzt" }).getByRole("button", { name: "Abstimmung starten" }).click();
    await sheetShot(page, `20-startsheet-${theme}`);
    await page.keyboard.press("Escape");

    // VoteSheet per Deeplink und die gesperrte Ideen-Liste dahinter
    await open(page, `/gift/${g.anna}?vote=1`, "Tippe alles an");
    await sheetShot(page, `21-votesheet-${theme}`);
    await page.keyboard.press("Escape");
    await open(page, `/gift/${g.anna}`, "pausiert");
    await shot(page, `22-gift-anna-ideen-gesperrt-${theme}`);

    // Ergebnis-Sheet: klarer Sieger, dann Gleichstand (je neue Runde), als Anna
    await setIdentity(page, "anna");
    round += HOUR;
    await pollDoc(g.christof).set(
      closedPoll({ anna: ["s-christof-1"], ben: ["s-christof-1", "s-christof-2"], max: ["s-christof-3"] }, round),
    );
    await open(page, `/gift/${g.christof}?vote=1`, "Entscheidung festlegen");
    await sheetShot(page, `23-decisionsheet-sieger-${theme}`);
    await page.keyboard.press("Escape");
    round += HOUR;
    await pollDoc(g.christof).set(closedPoll({ anna: ["s-christof-1"], ben: ["s-christof-2"] }, round));
    await open(page, `/gift/${g.christof}?vote=1`, "Gleichstand");
    await sheetShot(page, `24-decisionsheet-gleichstand-${theme}`);
    await page.keyboard.press("Escape");
  }
  await setDarkMode(true);
}

/** Offene/bestätigte Geschenk-IDs pro Person aus dem Emulator lesen. */
async function readGiftIds() {
  const snap = await getDb().collection(`groups/${GROUP_ID}/gifts`).get();
  const ids = {};
  snap.docs
    .filter((d) => d.data().status !== "received")
    .forEach((d) => (ids[d.data().personId] = d.id));
  return ids;
}

export async function runShots({ giftIds } = {}) {
  const g = giftIds ?? (await readGiftIds());
  mkdirSync(OUT_DIR, { recursive: true });

  const vite = startVite();
  let browser;
  try {
    await waitForServer(vite);
    console.log(`[emu-shots] Vite läuft auf ${BASE}`);
    browser = await chromium.launch();

    // Warm-up: Vite optimiert Dependencies beim ersten Aufruf (ggf. Reload).
    {
      const warm = await newPage(browser, { label: "warmup" });
      await warm.goto(`${BASE}/login`);
      await warm.getByPlaceholder("Gruppen-ID").waitFor({ timeout: 90_000 });
      await wait(3000);
      await warm.context().close();
    }

    // 01 Login (frischer Kontext)
    const loginPage = await newPage(browser, { label: "login" });
    await loginPage.goto(`${BASE}/login`);
    await loginPage.getByPlaceholder("Gruppen-ID").waitFor();
    await wait(900);
    await shot(loginPage, "01-login-dark");
    await loginPage.context().close();

    // Haupt-Kontext: echte Anmeldung über die UI (joinGroup-Function im Emulator)
    const page = await newPage(browser, { label: "main" });
    await login(page);

    // ── Identität Anna ──
    await setIdentity(page, "anna");
    await open(page, "/", "Christof");
    await shot(page, "02-home-dark");
    await open(page, "/people", "Sophie");
    await shot(page, "03-people-dark");
    await open(page, "/person/ben", "JBL");
    await shot(page, "04-person-ben-wunschliste-dark");
    await page.getByRole("button", { name: "Geschenke", exact: true }).first().click();
    await wait(900);
    await shot(page, "05-person-ben-geschenke-dark");

    // ── Identität Ben ──
    await setIdentity(page, "ben");
    await open(page, `/gift/${g.anna}`, "Keramik");
    await shot(page, "06-gift-anna-aktive-abstimmung-dark");

    // ── Identität Anna ──
    await setIdentity(page, "anna");
    await open(page, `/gift/${g.ben}`, "Espresso");
    await shot(page, "07-gift-ben-offen-dark");
    await open(page, `/gift/${g.lena}`, "Yogamatte");
    await shot(page, "08-gift-lena-bestaetigt-dark");

    // ── Identität Christof (Spoiler-Fall) ──
    await setIdentity(page, "christof");
    await open(page, `/gift/${g.christof}`, "Christof · Geburtstag");
    await shot(page, "09-gift-christof-als-christof-dark");
    await open(page, "/", "Anna");
    await shot(page, "10-home-als-christof-dark");
    await open(page, "/wishlist", "Kopfhörer");
    await shot(page, "11-wishlist-tab-als-christof-dark");

    // ── Identität Anna ──
    await setIdentity(page, "anna");
    await open(page, "/settings", "Anna");
    await shot(page, "12-settings-dark");
    await tutorialShots(page, "dark");
    await open(page, "/feedback");
    await shot(page, "14-feedback-dark");
    await open(page, "/past", "Max");
    await shot(page, "15-past-gifts-dark");
    await open(page, `/gift/${g.christof}`, "Plattenspieler");
    await shot(page, "16-gift-christof-als-anna-dark");

    // 17 Share-Dialog im Geschenk für Anna — als Ben (Anna wäre die Beschenkte)
    await setIdentity(page, "ben");
    await open(page, `/gift/${g.anna}`, "Keramik");
    await page.locator('[title="Link teilen"]').first().click();
    await wait(900);
    await shot(page, "17-share-dialog-dark");

    // 18 Hilfe-Sheet („?“ im Header)
    await setIdentity(page, "anna");
    await helpShot(page, "dark");

    // 19 First-Run: frischer Kontext ohne Keys und ohne Identität → Tutorial,
    // nach „Überspringen“ das IdentitySheet (Onboarding-Schritt „Wer bist du?“).
    const fresh = await newPage(browser, { suppress: false, label: "first-run" });
    await login(fresh);
    await fresh.waitForURL(/\/tutorial$/);
    await wait(1200);
    await sheetShot(fresh, "19-first-run-dark");
    await fresh.getByRole("button", { name: "Überspringen" }).click();
    await fresh.getByRole("dialog", { name: "Wer bist du?" }).waitFor();
    await sheetShot(fresh, "19b-first-run-identitaet-dark");
    await fresh.context().close();

    // 25 Home ohne Identität (Header mit „Wer bist du?“-Chip, „?“ und Gruppe)
    const noId = await newPage(browser, { label: "ohne-identitaet" });
    await login(noId);
    await open(noId, "/", "Christof");
    await shot(noId, "25-home-ohne-identitaet-dark");

    // ── Light-Mode (Gruppen-Einstellung per Admin) ──
    await setDarkMode(false);
    await setIdentity(page, "anna");
    await open(page, "/", "Christof");
    await shot(page, "02-home-light");
    await setIdentity(page, "ben");
    await open(page, `/gift/${g.anna}`, "Keramik");
    await shot(page, "06-gift-anna-aktive-abstimmung-light");
    await setIdentity(page, "anna");
    await open(page, `/gift/${g.ben}`, "Espresso");
    await shot(page, "07-gift-ben-offen-light");
    await open(page, "/settings", "Anna");
    await shot(page, "12-settings-light");
    await tutorialShots(page, "light");
    await helpShot(page, "light");
    await open(noId, "/", "Christof");
    await shot(noId, "25-home-ohne-identitaet-light");
    await noId.context().close();
    await setDarkMode(true);

    // ── Abstimmung (F1): Sheets in beiden Themes ──
    await pollShots(page, g);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (vite.exitCode === null) vite.kill();
  }

  if (pageErrors.length) {
    console.warn(`[emu-shots] ${pageErrors.length} Browser-Fehlermeldungen:`);
    for (const e of [...new Set(pageErrors)].slice(0, 30)) console.warn("  " + e);
  }
  console.log(`[emu-shots] ${shots.length} Screenshots in ${OUT_DIR}`);
  return shots;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runShots()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[emu-shots] Fehler:", e);
      process.exit(1);
    });
}
