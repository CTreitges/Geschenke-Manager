// Browser-Helfer für Screenshots (e2e/emu-shots.mjs) und axe-Scan
// (e2e/tests/a11y.spec.ts): Anmelden, Kontexte je Art, Animationen abwarten.

import { GROUP_ID, GROUP_PASSWORD } from "./emu-seed.mjs";

// Onboarding unterdrücken – Keys wie in src/lib/onboarding.ts (ONBOARDING_KEYS,
// TUTORIAL_VERSION); .mjs kann das TS-Modul nicht importieren.
export const SUPPRESS_KEYS = {
  "gm:onboarding:tutorial": "6",
  "gm:onboarding:identity-asked": "yes",
  "gm:pwa-install-tip-seen:v1": "yes",
};

// ── Browser-Helfer ───────────────────────────────────────

export async function login(page) {
  await page.goto("/login");
  await page.getByPlaceholder("Gruppen-ID").fill(GROUP_ID);
  await page.getByPlaceholder("Passwort").fill(GROUP_PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  await page.getByText("Lade Gruppendaten…").waitFor({ state: "detached", timeout: 30_000 }).catch(() => {});
}

/** Wartet, bis alle endlichen CSS-/Web-Animationen (Sheets, Toasts) durch sind. */
export async function settle(page) {
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter((a) => a.effect?.getTiming().iterations !== Infinity && a.playState === "running");
    await Promise.race([
      Promise.all(finite.map((a) => a.finished.catch(() => undefined))),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  });
}

/** UID des angemeldeten Firebase-Users (IndexedDB-Persistenz des Auth-SDK). */
export async function currentUid(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open("firebaseLocalStorageDb");
        req.onerror = () => resolve(null);
        req.onsuccess = () => {
          const all = req.result.transaction("firebaseLocalStorage", "readonly").objectStore("firebaseLocalStorage").getAll();
          all.onerror = () => resolve(null);
          all.onsuccess = () =>
            resolve(all.result.find((r) => String(r.fbase_key).startsWith("firebase:authUser:"))?.value?.uid ?? null);
        };
      }),
  );
}

/**
 * Browser-Kontext je Art: "main"/"noIdentity" (angemeldet, Onboarding
 * unterdrückt), "firstRun" (angemeldet, Onboarding läuft), "loggedOut".
 */
export async function openSession(browser, baseURL, kind, onPage) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    locale: "de-DE",
  });
  // Headless-Chromium meldet Notification.permission immer als „denied“.
  // Echte Erstnutzer sehen „default“ (→ „Einrichten“); die Mitteilungen-Szene
  // setzt window.__gmNotifyPermission = "granted".
  await context.addInitScript(() => {
    try {
      Object.defineProperty(Notification, "permission", {
        configurable: true,
        get: () => window.__gmNotifyPermission ?? "default",
      });
    } catch {
      /* ohne Notification-API: egal */
    }
  });
  if (kind !== "firstRun") {
    await context.addInitScript((kv) => {
      for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
    }, SUPPRESS_KEYS);
  }
  const page = await context.newPage();
  // Erster Dev-Server-Aufruf bündelt Dependencies — kann > 30 s dauern.
  page.setDefaultNavigationTimeout(120_000);
  page.setDefaultTimeout(30_000);
  onPage?.(page, kind);
  if (kind !== "loggedOut" && kind !== "firstRun") await login(page);
  return { context, page };
}
