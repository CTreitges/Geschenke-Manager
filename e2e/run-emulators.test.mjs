import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acquireLock, buildCommand, releaseLock } from "./emu-lib.mjs";

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

  it("lehnt Filter mit Shell-Sonderzeichen ab, statt sie halb gequotet weiterzugeben", () => {
    expect(() => buildCommand([...E2E, "-g", "a&echo x"])).toThrow(/Sonderzeichen.*a&echo x/);
    expect(() => buildCommand([...E2E, "-g", "a|b"])).toThrow(/Sonderzeichen/);
  });
});

describe("run-emulators Sperre gegen parallele Läufe", () => {
  let dir;
  let lockPath;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "emu-lock-"));
    lockPath = path.join(dir, "emu.lock");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("zweiter Lauf bekommt die Sperre nicht, solange der Halter lebt", () => {
    expect(acquireLock(lockPath, process.pid)).toBe(true);
    expect(acquireLock(lockPath, 4242)).toBe(process.pid);
    expect(readFileSync(lockPath, "utf8")).toBe(String(process.pid));
  });

  it("übernimmt eine verwaiste Sperre eines beendeten Prozesses", async () => {
    const dead = spawn(process.execPath, ["-e", ""]);
    await new Promise((r) => dead.once("exit", r));
    writeFileSync(lockPath, String(dead.pid));

    expect(acquireLock(lockPath, process.pid)).toBe(true);
    expect(readFileSync(lockPath, "utf8")).toBe(String(process.pid));
  });

  it("unlesbare Sperre gilt als belegt", () => {
    writeFileSync(lockPath, "kaputt");
    expect(acquireLock(lockPath, process.pid)).toBeNaN();
  });

  it("gibt nur die eigene Sperre frei", () => {
    writeFileSync(lockPath, String(process.pid));
    releaseLock(lockPath, 4242);
    expect(existsSync(lockPath)).toBe(true);
    releaseLock(lockPath, process.pid);
    expect(existsSync(lockPath)).toBe(false);
  });
});
