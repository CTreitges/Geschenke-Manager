import { describe, expect, it } from "vitest";
import { buildCommand } from "./run-emulators.mjs";

// So ruft package.json das Skript auf; `npm run e2e -- <filter>` hängt den Filter hinten an.
const E2E = ["--only", "auth,firestore,functions", "--project", "demo-geschenke", "npx playwright test -c e2e/playwright.config.ts"];
const FIREBASE = "firebase emulators:exec --only auth,firestore,functions --project demo-geschenke";

describe("run-emulators buildCommand", () => {
  it("hängt einen Filter an den Testbefehl, nicht an firebase", () => {
    expect(buildCommand([...E2E, "tests/abstimmung.spec.ts"])).toBe(
      `${FIREBASE} "npx playwright test -c e2e/playwright.config.ts tests/abstimmung.spec.ts"`,
    );
  });

  it("quotet Filter mit Leerzeichen innerhalb des Testbefehls", () => {
    expect(buildCommand([...E2E, "-g", "Wunsch liste"])).toBe(
      `${FIREBASE} "npx playwright test -c e2e/playwright.config.ts -g \\"Wunsch liste\\""`,
    );
  });

  it("ohne Filter bleibt der Befehl wie bisher", () => {
    expect(buildCommand(E2E)).toBe(`${FIREBASE} "npx playwright test -c e2e/playwright.config.ts"`);
  });
});
