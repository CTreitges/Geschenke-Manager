// Startet `firebase emulators:exec <Argumente>` mit FUNCTIONS_DISCOVERY_TIMEOUT=90
// (Sekunden). Hintergrund: Das Laden von functions/lib dauert auf langsamen
// Rechnern länger als die 10 s Standard-Frist – dann fehlen die Functions im
// Emulator und jeder Login scheitert. Plattformunabhängig ohne cross-env:
//   node e2e/run-emulators.mjs --only firestore --project demo-geschenke "npx vitest run"
// Ein schon gesetzter Wert in der Umgebung hat Vorrang.

import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const env = { ...process.env, FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT || "90" };

// firebase ist unter Windows eine .cmd-Datei → nur über die Shell startbar.
// Argumente mit Leerzeichen (der auszuführende Befehl) daher selbst quoten.
const quote = (a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
const command = ["firebase", "emulators:exec", ...args].map(quote).join(" ");

const child = spawn(command, { stdio: "inherit", env, shell: true });
child.on("error", (e) => {
  console.error("[run-emulators] firebase ließ sich nicht starten:", e.message);
  process.exit(1);
});
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
