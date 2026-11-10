import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { loadTokensByUid } from "./tokens";

function fakeDb(docs: Record<string, Record<string, unknown> | undefined>) {
  const requested: string[][] = [];
  const db = {
    doc: (path: string) => ({ path }),
    getAll: async (...refs: { path: string }[]) => {
      requested.push(refs.map((r) => r.path));
      return refs.map((r) => {
        const id = r.path.split("/")[1];
        const data = docs[id];
        return { id, exists: data !== undefined, data: () => data };
      });
    },
  };
  return { db: db as unknown as Firestore, requested };
}

describe("loadTokensByUid", () => {
  it("liefert die Token-Keys je UID, UIDs ohne Doc oder ohne Tokens fehlen", async () => {
    const { db } = fakeDb({
      u1: { "tok-a": { ua: "x" }, "tok-b": { ua: "y" } },
      u2: {},
    });
    await expect(loadTokensByUid(db, ["u1", "u2", "u3"])).resolves.toEqual({ u1: ["tok-a", "tok-b"] });
  });

  it("liest jede UID nur einmal und ohne UIDs gar nicht", async () => {
    const { db, requested } = fakeDb({ u1: { t: {} } });
    await loadTokensByUid(db, ["u1", "u1", ""]);
    expect(requested).toEqual([["pushTokens/u1"]]);
    await expect(loadTokensByUid(db, [])).resolves.toEqual({});
    expect(requested).toHaveLength(1);
  });
});
