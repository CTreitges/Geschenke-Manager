// Seed + Screenshots gegen die lokalen Emulatoren (Projekt demo-geschenke).
// Aufruf über `npm run emu:shots` — firebase emulators:exec startet und
// stoppt Auth/Firestore/Functions selbst und setzt FIRESTORE_EMULATOR_HOST.

import { seed } from "./emu-seed.mjs";
import { runShots } from "./emu-shots.mjs";

try {
  const { giftIds } = await seed();
  console.log("[emu-run] Seed fertig:", giftIds);
  await runShots({ giftIds });
  process.exit(0);
} catch (e) {
  console.error("[emu-run] Fehler:", e);
  process.exit(1);
}
