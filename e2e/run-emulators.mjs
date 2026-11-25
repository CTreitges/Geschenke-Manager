// Startet `firebase emulators:exec <Argumente>` mit FUNCTIONS_DISCOVERY_TIMEOUT=90
// (Sekunden). Hintergrund: Das Laden von functions/lib dauert auf langsamen
// Rechnern länger als die 10 s Standard-Frist – dann fehlen die Functions im
// Emulator und jeder Login scheitert. Plattformunabhängig ohne cross-env:
//   node e2e/run-emulators.mjs --only firestore --project demo-geschenke "npx vitest run"
// Ein schon gesetzter Wert in der Umgebung hat Vorrang.
//
// Argumente nach dem Testbefehl (dem ersten Argument mit Leerzeichen) gehören
// zum Testbefehl: `npm run e2e -- tests/x.spec.ts` filtert also Playwright.
//
// Eigener Emulator (Details e2e/emu-lib.mjs): Sperre gegen parallele Läufe,
// Abbruch bei belegtem Port 8080 (nichts wird beendet), PID des Firestore-
// Lauschers in e2e/.emu-owner.json, am Ende cleanup() nur für diese PID.

import { spawn } from "node:child_process";
import { FIRESTORE_PORT, LOCK_PATH, acquireLock, buildCommand, cleanup, listenerPids, releaseLock, writeOwnerMarker } from "./emu-lib.mjs";

const fail = (msg) => {
  console.error(`[run-emulators] ${msg}`);
  process.exit(1);
};

let command;
try {
  command = buildCommand(process.argv.slice(2));
} catch (e) {
  fail(e.message);
}

const lock = acquireLock();
if (lock !== true) fail(`Ein anderer Emulator-Lauf ist aktiv (PID ${lock}, Sperre ${LOCK_PATH}). Abbruch, nichts beendet.`);
const busy = listenerPids(FIRESTORE_PORT) ?? [];
if (busy.length > 0) {
  releaseLock();
  fail(`Port :${FIRESTORE_PORT} ist belegt (PID ${busy.join(", ")}) – läuft ein anderer Emulator-Lauf? Abbruch, nichts beendet.`);
}

const env = { ...process.env, FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT || "90" };
const child = spawn(command, { stdio: "inherit", env, shell: true });

// Strg+C trifft auch firebase: weiterlaufen, bis firebase endet, dann aufräumen.
// Context7: Node.js v22.23.4 – mit SIGINT-Listener beendet sich Node nicht selbst.
process.on("SIGINT", () => {});

// Port war frei und die Sperre gehört uns → der erste Lauscher ist der
// Firestore-Emulator dieses Laufs.
const watch = setInterval(() => {
  const pids = listenerPids(FIRESTORE_PORT);
  if (pids?.length === 1) {
    writeOwnerMarker(pids[0]);
    clearInterval(watch);
  }
}, 1000);

child.on("error", (e) => {
  clearInterval(watch);
  releaseLock();
  fail(`firebase ließ sich nicht starten: ${e.message}`);
});
child.on("exit", async (code, signal) => {
  clearInterval(watch);
  await cleanup();
  releaseLock();
  process.exit(code ?? (signal ? 1 : 0));
});
