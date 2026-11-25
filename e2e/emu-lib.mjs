// Bausteine für e2e/run-emulators.mjs und e2e/emu-cleanup.mjs (dort nur die
// Kommandozeile). Getestet in e2e/*.test.mjs, ohne echten Emulator.
//
// Eigener Emulator: Eine rechnerweite Sperre (Temp-Ordner) verhindert, dass zwei
// Läufe – auch aus verschiedenen Worktrees – gleichzeitig starten. run-emulators
// vermerkt die PID des Firestore-Lauschers in e2e/.emu-owner.json. cleanup()
// beendet nur, wenn dieser Marker existiert UND genau diese PID noch auf dem
// Port lauscht. Ein fremder Emulator wird nur gemeldet, nie beendet – kein Kill
// per Name oder Port allein.

import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FIRESTORE_PORT = 8080; // firebase.json → emulators.firestore.port
export const MARKER_PATH = fileURLToPath(new URL(".emu-owner.json", import.meta.url));
export const LOCK_PATH = path.join(tmpdir(), `geschenke-manager-emu-${FIRESTORE_PORT}.lock`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Befehl ----------

// firebase ist unter Windows eine .cmd-Datei → nur über die Shell startbar.
// Argumente mit Leerzeichen (der auszuführende Befehl) daher selbst quoten.
const quote = (a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
// Der Filter läuft durch zwei Shells (cmd.exe/sh für firebase, dann die Shell,
// in der firebase den Testbefehl startet) – Sonderzeichen werden abgelehnt statt
// halb gequotet.
const SHELL_META = /[&|<>^%!"'`$;()]/;

/**
 * firebase-Befehl. Argumente nach dem Testbefehl (dem ersten Argument mit
 * Leerzeichen) gehören zum Testbefehl, z. B. ein Playwright-Filter.
 */
export function buildCommand(args) {
  const i = args.findIndex((a) => /\s/.test(a));
  if (i === -1) return ["firebase", "emulators:exec", ...args].map(quote).join(" ");
  const extra = args.slice(i + 1);
  const bad = extra.find((a) => SHELL_META.test(a));
  if (bad !== undefined) throw new Error(`Filter mit Shell-Sonderzeichen wird nicht unterstützt: ${bad}`);
  const testCommand = [args[i], ...extra.map(quote)].join(" ");
  return ["firebase", "emulators:exec", ...args.slice(0, i), testCommand].map(quote).join(" ");
}

// ---------- Lauscher auf dem Port ----------

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

/** PIDs der Prozesse, die gerade auf `port` lauschen; null, wenn nicht ermittelbar. */
export function listenerPids(port) {
  try {
    if (process.platform === "win32") return parseNetstat(execFileSync("netstat", ["-ano"], { encoding: "utf8" }), port);
    const out = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" });
    return [...new Set(out.split(/\s+/).filter(Boolean).map(Number))];
  } catch (e) {
    // lsof meldet „niemand lauscht“ mit Exit 1 ohne Ausgabe.
    if (process.platform !== "win32" && e.status === 1 && !String(e.stdout ?? "").trim()) return [];
    return null;
  }
}

// ---------- Marker und Aufräumen ----------

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

/**
 * Beendet den eigenen Emulator auf `port`: erst POST /shutdown, nach `graceMs`
 * per process.kill(gespeicherte PID). Rückgabe "stopped" | "foreign" | "none" |
 * "unknown" (Lauscher nicht ermittelbar → nichts angefasst, Marker bleibt).
 */
export async function cleanup({ port = FIRESTORE_PORT, markerPath = MARKER_PATH, graceMs = 10_000, pidsOf = listenerPids } = {}) {
  const pids = pidsOf(port);
  if (pids === null) {
    console.log(`[emu-cleanup] Lauscher auf :${port} nicht ermittelbar (netstat/lsof) – nichts angefasst`);
    return "unknown";
  }
  const marker = readMarker(markerPath);
  const own = marker?.port === port && Number.isInteger(marker.pid) && pids.includes(marker.pid);

  if (!own) {
    rmSync(markerPath, { force: true }); // eigener Emulator ist schon weg → Marker veraltet
    if (pids.length === 0) return "none";
    console.log(`[emu-cleanup] :${port} gehört nicht diesem Lauf (PID ${pids.join(", ")}) – nicht angefasst`);
    return "foreign";
  }

  const gone = async (ms) => {
    for (let t = 0; ; t += 250) {
      const now = pidsOf(port);
      if (now !== null && !now.includes(marker.pid)) return true;
      if (t >= ms) return false;
      await wait(250);
    }
  };
  await fetch(`http://127.0.0.1:${port}/shutdown`, { method: "POST", signal: AbortSignal.timeout(2000) }).catch(() => {});
  if (!(await gone(graceMs))) {
    try {
      process.kill(marker.pid); // Context7: Node.js v22.23.4 – unter Windows sofortiges Beenden
    } catch {
      // schon beendet
    }
    await gone(5000);
  }
  rmSync(markerPath, { force: true });
  console.log(`[emu-cleanup] eigenen Firestore-Emulator auf :${port} beendet (PID ${marker.pid})`);
  return "stopped";
}

// ---------- Sperre gegen parallele Läufe ----------

function isAlive(pid) {
  try {
    process.kill(pid, 0); // Context7: Node.js v22.23.4 – Signal 0 prüft nur, ob der Prozess existiert
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

function readLock(lockPath) {
  try {
    return Number(readFileSync(lockPath, "utf8"));
  } catch {
    return NaN;
  }
}

/**
 * Nimmt die Sperre atomar (Flag "wx"). Gehört sie einem Prozess, der nicht mehr
 * läuft, wird sie übernommen. Rückgabe: true = genommen, sonst die PID des
 * Halters (NaN, wenn unlesbar – dann lieber nicht starten).
 */
export function acquireLock(lockPath = LOCK_PATH, pid = process.pid) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(lockPath, String(pid), { flag: "wx" });
      return true;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
    const holder = readLock(lockPath);
    if (!(Number.isInteger(holder) && holder > 0) || isAlive(holder)) return holder;
    rmSync(lockPath, { force: true }); // Halter ist beendet → verwaiste Sperre
  }
  return readLock(lockPath);
}

/** Gibt die Sperre frei, aber nur, wenn sie noch diesem Prozess gehört. */
export function releaseLock(lockPath = LOCK_PATH, pid = process.pid) {
  if (readLock(lockPath) === pid) rmSync(lockPath, { force: true });
}
