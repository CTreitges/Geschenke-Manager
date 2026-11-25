// Beendet einen verwaisten lokalen Firestore-Emulator (Port 8080, siehe
// firebase.json) – aber nur den eigenen. Hintergrund: Unter Windows lässt
// `firebase emulators:exec` den java.exe-Prozess des Firestore-Emulators nach
// dem Beenden weiterlaufen — der nächste Lauf scheitert dann mit "port taken".
// Läuft am Ende von run-emulators.mjs und als pre-/post-Hook der Emulator-Skripte.
//
// Eigen heißt: run-emulators.mjs hat beim Start die PID des Lauschers auf dem
// Port in e2e/.emu-owner.json vermerkt UND genau diese PID lauscht jetzt noch
// dort. Ein fremder Emulator (paralleler Lauf aus einem anderen Checkout oder
// Worktree) wird nur gemeldet, nie beendet – kein Kill per Name oder Port allein.

import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export const FIRESTORE_PORT = 8080;
export const MARKER_PATH = fileURLToPath(new URL(".emu-owner.json", import.meta.url));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * PIDs aus `netstat -ano`, die auf TCP-Port `port` lauschen. Lauschend heißt
 * Gegenstelle 0.0.0.0:0 bzw. [::]:0 – der Status-Text ist sprachabhängig
 * (LISTENING / ABHÖREN) und wird deshalb nicht ausgewertet.
 */
export function parseNetstat(output, port) {
  const pids = new Set();
  for (const line of output.split(/\r?\n/)) {
    const [proto, local, remote, , pid] = line.trim().split(/\s+/);
    if (proto === "TCP" && local?.endsWith(`:${port}`) && /^(0\.0\.0\.0|\[::\]):0$/.test(remote ?? "")) {
      pids.add(Number(pid));
    }
  }
  return [...pids];
}

/** PIDs der Prozesse, die gerade auf `port` lauschen ([] bei Fehler). */
export function listenerPids(port) {
  try {
    if (process.platform === "win32") return parseNetstat(execFileSync("netstat", ["-ano"], { encoding: "utf8" }), port);
    // lsof endet mit Code 1, wenn niemand lauscht → catch.
    const out = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" });
    return [...new Set(out.split(/\s+/).filter(Boolean).map(Number))];
  } catch {
    return [];
  }
}

export function writeOwnerMarker(pid, { port = FIRESTORE_PORT, markerPath = MARKER_PATH } = {}) {
  writeFileSync(markerPath, `${JSON.stringify({ port, pid, startedAt: new Date().toISOString() }, null, 2)}\n`);
}

function readMarker(markerPath) {
  try {
    return JSON.parse(readFileSync(markerPath, "utf8"));
  } catch {
    return null;
  }
}

async function waitUntilGone(port, pid, ms) {
  for (let t = 0; t < ms; t += 250) {
    if (!listenerPids(port).includes(pid)) return true;
    await wait(250);
  }
  return !listenerPids(port).includes(pid);
}

/**
 * Beendet den eigenen Emulator auf `port`: erst POST /shutdown, nach `graceMs`
 * per process.kill(gespeicherte PID). Rückgabe "stopped" | "foreign" | "none".
 */
export async function cleanup({ port = FIRESTORE_PORT, markerPath = MARKER_PATH, graceMs = 10_000 } = {}) {
  const marker = readMarker(markerPath);
  const pids = listenerPids(port);
  const own = marker?.port === port && Number.isInteger(marker.pid) && pids.includes(marker.pid);

  if (!own) {
    rmSync(markerPath, { force: true }); // eigener Emulator ist schon weg → Marker veraltet
    if (pids.length === 0) return "none";
    console.log(`[emu-cleanup] :${port} gehört nicht diesem Lauf (PID ${pids.join(", ")}) – nicht angefasst`);
    return "foreign";
  }

  await fetch(`http://127.0.0.1:${port}/shutdown`, { method: "POST", signal: AbortSignal.timeout(2000) }).catch(() => {});
  if (!(await waitUntilGone(port, marker.pid, graceMs))) {
    try {
      process.kill(marker.pid); // Context7: Node.js v22.23.4 – unter Windows sofortiges Beenden
    } catch {
      // schon beendet
    }
    await waitUntilGone(port, marker.pid, 5000);
  }
  rmSync(markerPath, { force: true });
  console.log(`[emu-cleanup] eigenen Firestore-Emulator auf :${port} beendet (PID ${marker.pid})`);
  return "stopped";
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await cleanup();
