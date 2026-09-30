import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { claimPushMarker, isAlreadyExists, releasePushMarker } from "./markers";

function dbWithCreate(create: () => Promise<unknown>) {
  const paths: string[] = [];
  const db = {
    doc: (path: string) => {
      paths.push(path);
      return { create };
    },
  };
  return { db: db as unknown as Firestore, paths };
}

describe("claimPushMarker", () => {
  it("true, wenn der Marker neu angelegt wurde", async () => {
    const { db, paths } = dbWithCreate(async () => undefined);
    await expect(claimPushMarker(db, "g1", "birthday-p1-2026", "birthday")).resolves.toBe(true);
    expect(paths).toEqual(["groups/g1/_push/birthday-p1-2026"]);
  });

  it("false bei ALREADY_EXISTS (schon verschickt)", async () => {
    const { db } = dbWithCreate(async () => {
      throw Object.assign(new Error("exists"), { code: 6 });
    });
    await expect(claimPushMarker(db, "g1", "k", "birthday")).resolves.toBe(false);
  });

  it("andere Fehler werden weitergereicht", async () => {
    const { db } = dbWithCreate(async () => {
      throw Object.assign(new Error("boom"), { code: 14 });
    });
    await expect(claimPushMarker(db, "g1", "k", "birthday")).rejects.toThrow("boom");
  });
});

describe("releasePushMarker", () => {
  it("löscht genau den Marker", async () => {
    const deleted: string[] = [];
    const db = { doc: (path: string) => ({ delete: async () => void deleted.push(path) }) };
    await releasePushMarker(db as unknown as Firestore, "g1", "poll_started-gift1-1");
    expect(deleted).toEqual(["groups/g1/_push/poll_started-gift1-1"]);
  });

  it("wirft nie, auch wenn das Löschen scheitert (best-effort)", async () => {
    const db = {
      doc: () => ({
        delete: async () => {
          throw Object.assign(new Error("unavailable"), { code: 14 });
        },
      }),
    };
    await expect(releasePushMarker(db as unknown as Firestore, "g1", "k")).resolves.toBeUndefined();
  });
});

describe("isAlreadyExists", () => {
  it("erkennt numerische und String-Codes", () => {
    expect(isAlreadyExists({ code: 6 })).toBe(true);
    expect(isAlreadyExists({ code: "already-exists" })).toBe(true);
    expect(isAlreadyExists({ code: 5 })).toBe(false);
    expect(isAlreadyExists(null)).toBe(false);
  });
});
