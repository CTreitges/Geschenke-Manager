import { describe, expect, it } from "vitest";
import { memoryFirestore } from "../test/memoryFirestore";
import { PBKDF2_DIGEST, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, hashPassword, verifyPassword } from "./password";

// Vorbestand: mit dem alten Code (crypto.pbkdf2Sync, origin/main 3327145,
// index.ts hashPassword) erzeugt – darf nach der Umstellung nicht ungültig werden.
const OLD_SALT = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";
const OLD_PASSWORD = "Geburtstag-2024!";
const OLD_HASH = "bfee48192a56b61a5847648795768402dc2e7ee086a6a8b34a9c4bfa22e78356";
// Noch älteres Format: SHA-256 ohne Salt im Feld passwordHash des Gruppen-Docs.
const LEGACY_PASSWORD = "alt-passwort";
const LEGACY_HASH = "18f5c926d1f2d477b46e05d15012a9123e0c1a07290c67735b145b6270ae66d3";

function groupWithHash() {
  return memoryFirestore({
    "groups/g1": { defaultBudget: 10 },
    "groups/g1/_meta/auth": { salt: OLD_SALT, hash: OLD_HASH, version: 1 },
  });
}

describe("PBKDF2-Parameter", () => {
  it("sind unverändert (210.000 Iterationen, 32 Byte, sha256)", () => {
    expect([PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST]).toEqual([210_000, 32, "sha256"]);
  });

  it("hashPassword liefert für den Vorbestand denselben Hash wie der alte Code", async () => {
    expect(await hashPassword(OLD_PASSWORD, OLD_SALT)).toBe(OLD_HASH);
  });
});

describe("verifyPassword mit Vorbestand", () => {
  it("akzeptiert den mit dem alten Code erzeugten Hash", async () => {
    await expect(verifyPassword(groupWithHash().db, "g1", OLD_PASSWORD)).resolves.toBeUndefined();
  });

  it("lehnt ein falsches Passwort mit permission-denied ab", async () => {
    await expect(verifyPassword(groupWithHash().db, "g1", "falsch")).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("migriert den SHA-256-Altbestand und akzeptiert danach den neuen Hash", async () => {
    const { db, docs } = memoryFirestore({ "groups/g1": { passwordHash: LEGACY_HASH } });
    await expect(verifyPassword(db, "g1", "falsch")).rejects.toMatchObject({ code: "permission-denied" });
    await verifyPassword(db, "g1", LEGACY_PASSWORD);
    const meta = docs.get("groups/g1/_meta/auth") as { salt: string; hash: string; version: number };
    expect(meta.version).toBe(1);
    expect(meta.hash).toBe(await hashPassword(LEGACY_PASSWORD, meta.salt));
    await expect(verifyPassword(db, "g1", LEGACY_PASSWORD)).resolves.toBeUndefined();
  });
});

describe("Event-Loop während der Ableitung", () => {
  it("bleibt frei: ein paralleler Timer feuert, bevor der Hash fertig ist", async () => {
    let ticks = 0;
    const timer = setInterval(() => ticks++, 1);
    try {
      let ticksWhenDone = -1;
      // Mehrere Ableitungen hintereinander, damit die Laufzeit sicher > 1 ms ist.
      await Promise.all([1, 2, 3].map(() => hashPassword(OLD_PASSWORD, OLD_SALT))).then(() => {
        ticksWhenDone = ticks;
      });
      expect(ticksWhenDone).toBeGreaterThan(0);
    } finally {
      clearInterval(timer);
    }
  });
});
