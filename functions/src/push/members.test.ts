import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { loadPushMembers } from "./members";

function fakeDb(docs: Record<string, Record<string, unknown> | undefined>) {
  const paths: string[] = [];
  const db = {
    collection: (path: string) => ({
      get: async () => {
        paths.push(path);
        return { docs: Object.entries(docs).map(([id, data]) => ({ id, data: () => data })) };
      },
    }),
  };
  return { db: db as unknown as Firestore, paths };
}

describe("loadPushMembers", () => {
  it("liest die Member-Docs der Gruppe als PushMember", async () => {
    const { db, paths } = fakeDb({
      "u-anna": { identityPersonId: "p-anna", notifyStack: true, notifyPolls: false, joinedAt: 1 },
      "u-ben": { identityPersonId: "p-ben" },
    });
    expect(await loadPushMembers(db, "g1")).toEqual([
      { uid: "u-anna", identityPersonId: "p-anna", notifyStack: true, notifyPolls: false },
      { uid: "u-ben", identityPersonId: "p-ben", notifyStack: false, notifyPolls: undefined },
    ]);
    expect(paths).toEqual(["groups/g1/members"]);
  });

  it("verwirft kaputte Werte statt sie weiterzureichen", async () => {
    const { db } = fakeDb({
      "u-x": { identityPersonId: 42, notifyStack: "ja", notifyPolls: "true" },
      "u-leer": undefined,
    });
    expect(await loadPushMembers(db, "g1")).toEqual([
      { uid: "u-x", identityPersonId: undefined, notifyStack: false, notifyPolls: undefined },
      { uid: "u-leer", identityPersonId: undefined, notifyStack: false, notifyPolls: undefined },
    ]);
  });
});
