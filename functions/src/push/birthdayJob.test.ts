import type { Firestore } from "firebase-admin/firestore";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runBirthdayPush } from "./birthdayJob";

/**
 * In-Memory-Firestore mit genau den Aufrufen, die der Job braucht. Versand
 * läuft über den Emulator-Transport (FUNCTIONS_EMULATOR=true) und landet in
 * groups/{gid}/_debugPush.
 */
function memoryDb(initial: Record<string, Record<string, unknown>>) {
  const docs = new Map<string, Record<string, unknown>>(Object.entries(initial));
  let autoId = 0;
  const childrenOf = (path: string) =>
    [...docs.keys()].filter((k) => k.startsWith(`${path}/`) && k.split("/").length === path.split("/").length + 1);
  const snap = (path: string) => ({
    id: path.split("/").pop() as string,
    exists: docs.has(path),
    data: () => docs.get(path),
  });
  const db = {
    collection: (path: string) => ({
      listDocuments: async () => {
        const ids = new Set(
          [...docs.keys()].filter((k) => k.startsWith(`${path}/`)).map((k) => k.split("/")[1]),
        );
        return [...ids].map((id) => ({ id }));
      },
      get: async () => ({ docs: childrenOf(path).map(snap) }),
      add: async (data: Record<string, unknown>) => {
        docs.set(`${path}/auto${++autoId}`, data);
      },
    }),
    doc: (path: string) => ({
      path,
      create: async (data: Record<string, unknown>) => {
        if (docs.has(path)) throw Object.assign(new Error("exists"), { code: 6 });
        docs.set(path, data);
      },
      update: async () => undefined,
    }),
    getAll: async (...refs: { path: string }[]) => refs.map((r) => snap(r.path)),
  };
  const debugPushes = (gid: string) =>
    childrenOf(`groups/${gid}/_debugPush`).map((k) => docs.get(k) as { tokens: string[]; data: Record<string, string> });
  return { db: db as unknown as Firestore, docs, debugPushes };
}

describe("runBirthdayPush", () => {
  const before = process.env.FUNCTIONS_EMULATOR;
  beforeEach(() => {
    process.env.FUNCTIONS_EMULATOR = "true";
  });
  afterEach(() => {
    if (before === undefined) delete process.env.FUNCTIONS_EMULATOR;
    else process.env.FUNCTIONS_EMULATOR = before;
  });

  // 30.09.2026 08:00 Wien; Anna hat am 30.10. Geburtstag (30 Tage).
  const now = new Date(Date.UTC(2026, 8, 30, 6, 0));

  function seed() {
    return memoryDb({
      "groups/g1": {},
      "groups/g1/persons/p-anna": { name: "Anna", birthday: "1990-10-30" },
      "groups/g1/persons/p-ben": { name: "Ben", birthday: "03-01" },
      "groups/g1/members/u-anna": { identityPersonId: "p-anna", notifyStack: true },
      "groups/g1/members/u-ben": { identityPersonId: "p-ben", notifyStack: true },
      "groups/g1/members/u-ben2": { identityPersonId: "p-ben", notifyStack: false },
      "pushTokens/u-anna": { "t-anna": {}, "t-shared": {} },
      "pushTokens/u-ben": { "t-ben": {}, "t-shared": {} },
      "groups/g2": {},
      "groups/g2/persons/p-x": { name: "X", birthday: "10-30" },
      "groups/g2/members/u-x": { notifyStack: false },
    });
  }

  it("schickt beiden Varianten genau einmal und nie an Annas Geräte", async () => {
    const { db, docs, debugPushes } = seed();
    const res = await runBirthdayPush(db, now);
    expect(res).toEqual({ sent: 3, groups: 1 });

    const pushes = debugPushes("g1");
    const others = pushes.find((p) => p.data.type === "birthday_stack");
    const self = pushes.find((p) => p.data.type === "birthday_self");
    expect(others?.tokens).toEqual(["t-ben"]); // t-shared gesperrt (Annas Gerät)
    expect(others?.data.title).toBe("🎂 Anna hat in 30 Tagen Geburtstag");
    expect(self?.tokens.sort()).toEqual(["t-anna", "t-shared"]);
    expect(self?.data.url).toBe("/wishlist");
    expect(docs.has("groups/g1/_push/birthday-p-anna-2026")).toBe(true);
    expect(debugPushes("g2")).toEqual([]);
  });

  it("zweiter Lauf im Fenster sendet nichts mehr (Marker)", async () => {
    const { db, debugPushes } = seed();
    await runBirthdayPush(db, now);
    const res = await runBirthdayPush(db, new Date(now.getTime() + 86_400_000));
    expect(res.sent).toBe(0);
    expect(debugPushes("g1")).toHaveLength(2);
  });

  it("holt einen ausgefallenen Lauf innerhalb des Fensters nach", async () => {
    const { db, debugPushes } = seed();
    const twoDaysLater = new Date(now.getTime() + 2 * 86_400_000); // 28 Tage
    await runBirthdayPush(db, twoDaysLater);
    expect(debugPushes("g1").map((p) => p.data.title)).toContain("🎂 Anna hat in 28 Tagen Geburtstag");
  });
});
