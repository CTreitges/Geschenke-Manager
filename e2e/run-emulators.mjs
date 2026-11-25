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
// Eigener Emulator: Ist Port 8080 vor dem Start belegt, bricht das Skript ab
// (fremder Lauf, nichts wird beendet). Sonst vermerkt es die PID des Firestore-
// Lauschers in e2e/.emu-owner.json; am Ende räumt emu-cleanup.mjs nur diese ab.

import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { FIRESTORE_PORT, cleanup, listenerPids, writeOwnerMarker } from "./emu-cleanup.mjs";

// firebase ist unter Windows eine .cmd-Datei → nur über die Shell startbar.
// Argumente mit Leerzeichen (der auszuführende Befehl) daher selbst quoten.
const quote = (a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

export function buildCommand(args) {
  const i = args.findIndex((a) => /\s/.test(a));
  if (i === -1) return ["firebase", "emulators:exec", ...args].map(quote).join(" ");
  const testCommand = [args[i], ...args.slice(i + 1).map(quote)].join(" ");
  return ["firebase", "emulators:exec", ...args.slice(0, i), testCommand].map(quote).join(" ");
}

function main() {
  const busy = listenerPids(FIRESTORE_PORT);
  if (busy.length > 0) {
    console.error(
      `[run-emulators] Port :${FIRESTORE_PORT} ist belegt (PID ${busy.join(", ")}) – läuft ein anderer Emulator-Lauf? Abbruch, nichts beendet.`,
    );
    process.exit(1);
  }

  const env = { ...process.env, FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT || "90" };
  const child = spawn(buildCommand(process.argv.slice(2)), { stdio: "inherit", env, shell: true });

  // Der Port war frei → der erste Lauscher ist der Firestore-Emulator dieses Laufs.
  const watch = setInterval(() => {
    const pids = listenerPids(FIRESTORE_PORT);
    if (pids.length === 1) {
      writeOwnerMarker(pids[0]);
      clearInterval(watch);
    }
  }, 1000);

  child.on("error", (e) => {
    console.error("[run-emulators] firebase ließ sich nicht starten:", e.message);
    process.exit(1);
  });
  child.on("exit", async (code, signal) => {
    clearInterval(watch);
    await cleanup();
    process.exit(code ?? (signal ? 1 : 0));
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
