import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, parseNetstat } from "./emu-lib.mjs";

// Attrappe eines Firestore-Emulators als eigener Prozess (eigene PID), nie ein
// echter Emulator: GET / → "Ok", POST /shutdown → beendet sich (außer mit
// ignoreShutdown, dann hilft nur der Kill). Lauscht auf `port` (0 = frei).
const DUMMY = `
const http = require("node:http");
const port = Number(process.argv[1]);
const ignoreShutdown = process.argv[2] === "1";
const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/shutdown") {
    res.end();
    if (!ignoreShutdown) process.exit(0);
    return;
  }
  res.end("Ok");
});
// Ein eben freigegebener Port ist unter Windows nicht immer sofort wieder frei.
let tries = 0;
server.on("error", (e) => {
  if (e.code !== "EADDRINUSE" || ++tries > 50) process.exit(1);
  setTimeout(() => server.listen(port, "127.0.0.1"), 100);
});
server.on("listening", () => console.log(server.address().port));
server.listen(port, "127.0.0.1");
`;

const running = [];

function startDummy(port = 0, { ignoreShutdown = false } = {}) {
  const proc = spawn(process.execPath, ["-e", DUMMY, String(port), ignoreShutdown ? "1" : "0"]);
  running.push(proc);
  const exited = new Promise((r) => proc.once("exit", r));
  return new Promise((resolve, reject) => {
    proc.once("error", reject);
    exited.then((code) => reject(new Error(`Attrappe vor dem Lauschen beendet (Code ${code})`)));
    proc.stdout.once("data", (d) => resolve({ proc, pid: proc.pid, port: Number(String(d).trim()), exited }));
  });
}

async function answers(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) });
    return (await res.text()) === "Ok";
  } catch {
    return false;
  }
}

let dir;
let markerPath;
const writeMarker = (port, pid) => writeFileSync(markerPath, JSON.stringify({ port, pid }));

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "emu-cleanup-"));
  markerPath = path.join(dir, ".emu-owner.json");
});

afterEach(() => {
  // Nur die eigenen Attrappen, über das gespeicherte Prozess-Objekt.
  for (const proc of running.splice(0)) if (proc.exitCode === null && proc.signalCode === null) proc.kill();
  rmSync(dir, { recursive: true, force: true });
});

// Prozess-Starts und netstat brauchen unter Last (parallele Testdateien) Zeit.
describe("emu-cleanup cleanup", { timeout: 20_000 }, () => {
  it("beendet den eigenen Emulator (Marker + passende Lauscher-PID) und löscht den Marker", async () => {
    const own = await startDummy();
    writeMarker(own.port, own.pid);

    expect(await cleanup({ port: own.port, markerPath })).toBe("stopped");
    expect(await answers(own.port)).toBe(false);
    expect(existsSync(markerPath)).toBe(false);
  });

  it("lässt einen fremden Emulator auf demselben Port leben, auch wenn der Marker auf den Port zeigt", async () => {
    // Eigener Lauf war auf dem Port und ist vorbei; jetzt lauscht dort ein fremder.
    const own = await startDummy();
    writeMarker(own.port, own.pid);
    own.proc.kill();
    await own.exited;
    const foreign = await startDummy(own.port);

    expect(await cleanup({ port: own.port, markerPath })).toBe("foreign");
    expect(await answers(foreign.port)).toBe(true);
    expect(existsSync(markerPath)).toBe(false); // veralteter Marker ist weg
  });

  it("ohne Marker bleibt ein Emulator unangetastet", async () => {
    const foreign = await startDummy();

    expect(await cleanup({ port: foreign.port, markerPath })).toBe("foreign");
    expect(await answers(foreign.port)).toBe(true);
  });

  it("beendet den eigenen per PID-Kill, wenn /shutdown nicht greift", async () => {
    const own = await startDummy(0, { ignoreShutdown: true });
    writeMarker(own.port, own.pid);

    expect(await cleanup({ port: own.port, markerPath, graceMs: 500 })).toBe("stopped");
    await own.exited;
    expect(await answers(own.port)).toBe(false);
  });

  it("lässt alles stehen und behält den Marker, wenn die Lauscher nicht ermittelbar sind", async () => {
    const own = await startDummy();
    writeMarker(own.port, own.pid);

    expect(await cleanup({ port: own.port, markerPath, pidsOf: () => null })).toBe("unknown");
    expect(await answers(own.port)).toBe(true);
    expect(existsSync(markerPath)).toBe(true);
  });
});

describe("emu-cleanup parseNetstat", () => {
  it("liest nur lauschende TCP-Sockets genau dieses Ports, unabhängig von der Sprache", () => {
    const out = [
      "  Proto  Lokale Adresse         Remoteadresse          Status           PID",
      "  TCP    127.0.0.1:8080         0.0.0.0:0              ABHÖREN          4242",
      "  TCP    [::1]:8080             [::]:0                 ABHÖREN          4242",
      "  TCP    127.0.0.1:8080         127.0.0.1:53211        HERGESTELLT      4242",
      "  TCP    127.0.0.1:53211        127.0.0.1:8080         HERGESTELLT      777",
      "  TCP    0.0.0.0:18080          0.0.0.0:0              LISTENING        999",
      "  UDP    0.0.0.0:8080           *:*                                     555",
    ].join("\r\n");
    expect(parseNetstat(out, 8080)).toEqual([4242]);
    expect(parseNetstat(out, 9099)).toEqual([]);
  });
});
