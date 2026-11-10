import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

// E2E gegen die LOKALEN Firebase-Emulatoren (Projekt demo-geschenke).
// Aufruf nur über `npm run e2e` — firebase emulators:exec startet/stoppt
// Auth, Firestore und Functions und setzt FIRESTORE_EMULATOR_HOST.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5174;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  outputDir: path.join(ROOT, "test-results"),
  globalSetup: "./tests/global-setup.ts",
  // Alle Tests teilen sich die geseedete Gruppe "demo" → seriell.
  workers: 1,
  fullyParallel: false,
  // Erster Dev-Server-Aufruf bündelt Dependencies — großzügige Timeouts.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    locale: "de-DE",
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium" }],
  webServer: {
    // --config explizit: ein veraltetes, gitignoriertes vite.config.js (tsc-Artefakt)
    // hätte sonst Vorrang. --host 127.0.0.1, weil "localhost" unter Node ≥ 17
    // auf ::1 auflösen kann und baseURL dann nicht erreichbar wäre.
    command: `npx vite --config vite.config.ts --mode emulator --host 127.0.0.1 --port ${PORT} --strictPort`,
    cwd: ROOT,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
