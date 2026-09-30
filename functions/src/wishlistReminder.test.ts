import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { hasFreshOwnWish } from "./wishlistReminder";

const DAY = 86_400_000;
const NOW = Date.parse("2026-09-30T12:00:00Z");

/** In-Memory-Firestore mit genau collection(path).where(field, "==", value).get(). */
function memoryDb(docs: Record<string, Record<string, unknown>>) {
  const queries: string[] = [];
  const db = {
    collection: (path: string) => ({
      where: (field: string, op: string, value: unknown) => ({
        get: async () => {
          queries.push(`${path} ${field} ${op} ${String(value)}`);
          const hits = Object.entries(docs).filter(
            ([k, v]) => k.startsWith(`${path}/`) && k.split("/").length === path.split("/").length + 1 && v[field] === value,
          );
          return { docs: hits.map(([k, v]) => ({ id: k.split("/").pop(), data: () => v })) };
        },
      }),
    }),
  };
  return { db: db as unknown as Firestore, queries };
}

describe("hasFreshOwnWish", () => {
  it("frischer eigener Wunsch setzt die Mail aus", async () => {
    const { db, queries } = memoryDb({
      "groups/g1/wishlist/w1": { personId: "anna", createdAt: NOW - 10 * DAY },
    });
    expect(await hasFreshOwnWish(db, "g1", "anna", NOW)).toBe(true);
    expect(queries).toEqual(["groups/g1/wishlist personId == anna"]);
  });

  it("nur alte, bekommene oder fremd notierte Wünsche → Mail geht raus", async () => {
    const { db } = memoryDb({
      "groups/g1/wishlist/alt": { personId: "anna", createdAt: NOW - 200 * DAY },
      "groups/g1/wishlist/bekommen": { personId: "anna", createdAt: NOW - 5 * DAY, fulfilledAt: NOW - DAY },
      "groups/g1/wishlist/von-ben": { personId: "anna", createdAt: NOW - 5 * DAY, addedBy: "ben" },
      "groups/g1/wishlist/fuer-ben": { personId: "ben", createdAt: NOW - 5 * DAY },
      "groups/g2/wishlist/andere-gruppe": { personId: "anna", createdAt: NOW - 5 * DAY },
    });
    expect(await hasFreshOwnWish(db, "g1", "anna", NOW)).toBe(false);
  });

  it("„Noch aktuell ✓“ (updatedAt) macht einen alten eigenen Wunsch wieder frisch", async () => {
    const { db } = memoryDb({
      "groups/g1/wishlist/alt": { personId: "anna", createdAt: NOW - 400 * DAY, updatedAt: NOW - 3 * DAY, addedBy: "anna" },
    });
    expect(await hasFreshOwnWish(db, "g1", "anna", NOW)).toBe(true);
  });

  it("leere Liste → Mail geht raus", async () => {
    const { db } = memoryDb({});
    expect(await hasFreshOwnWish(db, "g1", "anna", NOW)).toBe(false);
  });
});
