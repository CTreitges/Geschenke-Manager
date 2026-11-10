import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Regression (archiveGroupDocChange schrieb im Emulator nie ins Archiv):
// Der Functions-Emulator ersetzt firebase-admin durch einen Proxy, der
// Namespace-Funktionen wie admin.firestore per bind() zurückgibt. Gebundene
// Funktionen haben keine statischen Member → admin.firestore.FieldValue ist
// dort undefined, in Produktion und in Unit-Tests aber nicht. Deshalb:
// FieldValue, Timestamp & Co. nur modular importieren
// (import { FieldValue } from "firebase-admin/firestore").

const STATIC_ON_NAMESPACE = /\badmin\.[a-z]\w*\.[A-Z]\w*/;

const root = fileURLToPath(new URL(".", import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return name.endsWith(".ts") && !name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("firebase-admin im Functions-Code", () => {
  const files = sources(root);

  it("findet Quelldateien und erkennt das alte Muster", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(STATIC_ON_NAMESPACE.test("admin.firestore.FieldValue.serverTimestamp()")).toBe(true);
    expect(STATIC_ON_NAMESPACE.test("admin.firestore.Timestamp.now()")).toBe(true);
    expect(STATIC_ON_NAMESPACE.test("const db = admin.firestore();")).toBe(false);
    expect(STATIC_ON_NAMESPACE.test("FieldValue.serverTimestamp()")).toBe(false);
  });

  it.each(files.map((f) => [relative(root, f), f]))(
    "%s greift nicht auf statische Member über den admin-Namespace zu",
    (_name, file) => {
      const offending = readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("//") && STATIC_ON_NAMESPACE.test(line));
      expect(offending).toEqual([]);
    },
  );
});
