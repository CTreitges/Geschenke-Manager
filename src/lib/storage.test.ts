// storage.ts mit nachgebautem Firestore (Node-Umgebung): die Snapshots kommen
// von Hand, geprüft wird, was tatsächlich geschrieben würde.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Next = (snap: unknown) => void;

const h = vi.hoisted(() => ({
  listeners: new Map<string, { next: (snap: unknown) => void; options: unknown }>(),
  batches: [] as { op: string; path: string; data?: unknown }[][],
  updates: [] as { path: string; data: unknown }[],
}));

vi.mock("./firebase", () => ({
  app: {},
  db: {},
  functions: {},
  auth: { currentUser: null },
  authReady: Promise.resolve("u1"),
}));
vi.mock("./auth", () => ({ getIdentity: () => null }));
vi.mock("firebase/auth", () => ({ onAuthStateChanged: () => () => undefined }));
vi.mock("firebase/functions", () => ({ httpsCallable: () => async () => ({ data: {} }) }));
vi.mock("firebase/firestore", () => {
  const ref = (_db: unknown, ...segments: string[]) => ({ path: segments.join("/") });
  return {
    collection: ref,
    doc: ref,
    query: (r: unknown) => r,
    where: () => ({}),
    limit: () => ({}),
    deleteField: () => "<deleteField>",
    FieldPath: class {},
    onSnapshot: (r: { path: string }, ...rest: unknown[]) => {
      const next = rest.find((x) => typeof x === "function") as Next;
      const options = rest[0] && typeof rest[0] === "object" ? rest[0] : undefined;
      h.listeners.set(r.path, { next, options });
      return () => undefined;
    },
    updateDoc: async (r: { path: string }, data: unknown) => {
      h.updates.push({ path: r.path, data });
    },
    writeBatch: () => {
      const ops: { op: string; path: string; data?: unknown }[] = [];
      return {
        delete: (r: { path: string }) => ops.push({ op: "delete", path: r.path }),
        update: (r: { path: string }, data: unknown) => ops.push({ op: "update", path: r.path, data }),
        commit: async () => {
          h.batches.push(ops);
        },
      };
    },
  };
});

const s = await import("./storage");

const autoGift = (id: string) => ({
  id,
  personId: "p1",
  year: 2026,
  status: "open",
  manuallyAdded: false,
  budgetPerPerson: 20,
  stackOrder: 0,
  enteredStackAt: 0,
  participantIds: [],
});

function emit(name: string, docs: { id: string }[], fromCache = false) {
  h.listeners.get(`groups/g1/${name}`)!.next({
    docs: docs.map((d) => ({ id: d.id, data: () => d })),
    metadata: { fromCache },
  });
}

async function start() {
  s.setActiveGroup("g1");
  await vi.waitFor(() => expect(h.listeners.has("groups/g1/persons")).toBe(true));
}

beforeEach(() => {
  h.listeners.clear();
  h.batches.length = 0;
  h.updates.length = 0;
});

afterEach(() => {
  s.setActiveGroup(null);
});

describe("deduplicateOpenGifts wartet auf alle Daten (R1)", () => {
  const idea = { id: "s1", giftId: "g-b", title: "Idee", suggestedBy: "p2", createdAt: 1 };

  async function duplicates() {
    await start();
    emit("persons", [{ id: "p1" }]);
    emit("gifts", [autoGift("g-a"), autoGift("g-b")]);
  }

  it("ohne Ideen-Snapshot wird nichts gelöscht", async () => {
    await duplicates();
    emit("polls", []);
    await expect(s.deduplicateOpenGifts()).resolves.toBe(0);
    expect(h.batches).toHaveLength(0);
  });

  it("ohne Abstimmungs-Snapshot wird nichts gelöscht", async () => {
    await duplicates();
    emit("suggestions", [idea]);
    await expect(s.deduplicateOpenGifts()).resolves.toBe(0);
    expect(h.batches).toHaveLength(0);
  });

  it("mit allen Daten: Doppel weg, Ideen wandern mit", async () => {
    await duplicates();
    emit("suggestions", [idea]);
    emit("polls", []);
    await expect(s.deduplicateOpenGifts()).resolves.toBe(1);
    const ops = h.batches[0];
    expect(ops.filter((o) => o.op === "delete" && o.path.includes("/gifts/"))).toHaveLength(1);
    // Wird das Geschenk der Idee gelöscht, muss die Idee umziehen.
    const giftOfIdeaDeleted = ops.some((o) => o.path === "groups/g1/gifts/g-b");
    expect(ops.some((o) => o.op === "update" && o.path === "groups/g1/suggestions/s1")).toBe(giftOfIdeaDeleted);
  });
});

describe("Personen-Stand vom Server (R2)", () => {
  it("meldet erst einen Server-Snapshot als bestätigt", async () => {
    await start();
    expect(h.listeners.get("groups/g1/persons")!.options).toEqual({ includeMetadataChanges: true });
    emit("persons", [], true);
    expect(s.getSnapshot().personsHydrated).toBe(true);
    expect(s.getSnapshot().personsFromServer).toBe(false);
    emit("persons", [{ id: "p1" }], false);
    expect(s.getSnapshot().personsFromServer).toBe(true);
  });
});

describe("updatePerson (R3)", () => {
  it("löscht geleerte Felder wirklich", async () => {
    await start();
    await s.updatePerson("p1", { name: "Anna", email: undefined, emailOptIn: undefined });
    expect(h.updates).toEqual([
      { path: "groups/g1/persons/p1", data: { name: "Anna", email: "<deleteField>", emailOptIn: "<deleteField>" } },
    ]);
  });
});
