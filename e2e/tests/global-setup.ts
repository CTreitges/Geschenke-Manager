import { chromium, type FullConfig } from "@playwright/test";
import { seed } from "../emu-seed.mjs";

/** Seedet die Demo-Gruppe und wärmt den Vite-Dev-Server auf. */
export default async function globalSetup(config: FullConfig) {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST fehlt — E2E nur über `npm run e2e` (firebase emulators:exec) starten.",
    );
  }
  const { giftIds } = await seed();
  console.log("[e2e] Seed fertig:", giftIds);

  // Vite optimiert beim ersten Aufruf die Dependencies und lädt die Seite
  // dabei ggf. neu. Zwei vollständige Ladevorgänge vor dem ersten Test
  // verhindern, dass dieser Reload mitten in einen Test fällt.
  const baseURL = config.projects[0].use.baseURL;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (let i = 0; i < 2; i++) {
      await page.goto(`${baseURL}/login`, { timeout: 120_000 });
      await page.getByPlaceholder("Gruppen-ID").waitFor({ timeout: 120_000 });
    }
  } finally {
    await browser.close();
  }
}
