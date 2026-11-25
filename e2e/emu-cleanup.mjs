// Beendet einen verwaisten lokalen Firestore-Emulator (Port 8080) – aber nur den
// eigenen (Marker e2e/.emu-owner.json UND passende Lauscher-PID, siehe
// e2e/emu-lib.mjs). Hintergrund: Unter Windows lässt `firebase emulators:exec`
// den java.exe-Prozess des Firestore-Emulators nach dem Beenden weiterlaufen —
// der nächste Lauf scheitert dann mit "port taken". Läuft am Ende von
// run-emulators.mjs und als pre-/post-Hook der Emulator-Skripte.

import { cleanup } from "./emu-lib.mjs";

await cleanup();
