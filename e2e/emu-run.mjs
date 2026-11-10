// Screenshots gegen die lokalen Emulatoren (Projekt demo-geschenke).
// Aufruf über `npm run emu:shots` — firebase emulators:exec startet und
// stoppt Auth/Firestore/Functions selbst und setzt FIRESTORE_EMULATOR_HOST.
// Geseedet wird je Theme in e2e/emu-scenes.mjs (runScenes).

import { runShots } from "./emu-shots.mjs";

try {
  await runShots();
  process.exit(0);
} catch (e) {
  console.error("[emu-run] Fehler:", e);
  process.exit(1);
}
