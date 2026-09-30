// Beendet einen verwaisten lokalen Firestore-Emulator auf 127.0.0.1:8080.
// Hintergrund: Unter Windows lässt `firebase emulators:exec` den java.exe-
// Prozess des Firestore-Emulators nach dem Beenden weiterlaufen — der nächste
// Lauf scheitert dann mit "port taken". Läuft als pre-/post-Hook von
// `npm run emu:shots`. Fährt nur etwas herunter, das sich als Firestore-
// Emulator ausweist (GET / → "Ok").

const BASE = "http://127.0.0.1:8080";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function isFirestoreEmulator() {
  try {
    const res = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(2000) });
    return res.ok && (await res.text()).trim() === "Ok";
  } catch {
    return false;
  }
}

if (await isFirestoreEmulator()) {
  await fetch(`${BASE}/shutdown`, { method: "POST" }).catch(() => {});
  for (let i = 0; i < 40 && (await isFirestoreEmulator()); i++) await wait(250);
  console.log("[emu-cleanup] verwaisten Firestore-Emulator auf :8080 beendet");
}
