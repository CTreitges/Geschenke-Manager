// In-Memory-Firestore für Unit-Tests der Functions (kein Emulator nötig).
// Bildet nur ab, was polls/* und push/* aufrufen: doc/collection/
// collectionGroup mit where("==")-Filter, getAll, create/update/set und
// runTransaction (Reads zuerst, Writes beim Commit). Liegt außerhalb von
// src/, damit tsc es nicht nach lib/ baut und es nie deployt wird.

import type { Firestore } from "firebase-admin/firestore";
import type { BatchResponse, MulticastMessage } from "firebase-admin/messaging";

type Data = Record<string, unknown>;

export interface MemoryFirestoreOptions {
  /** Läuft vor jeder Transaktion — simuliert parallele Writes (z. B. Verlängern). */
  beforeTransaction?: (docs: Map<string, Data>) => void;
}

interface Snap {
  id: string;
  exists: boolean;
  ref: DocRef;
  data: () => Data | undefined;
}

interface DocRef {
  id: string;
  path: string;
  parent: CollRef;
  get: () => Promise<Snap>;
  create: (data: Data) => Promise<void>;
  set: (data: Data) => Promise<void>;
  update: (data: unknown, ...rest: unknown[]) => Promise<void>;
}

interface CollRef {
  id: string;
  path: string;
  parent: DocRef | null;
}

export function memoryFirestore(initial: Record<string, Data>, options: MemoryFirestoreOptions = {}) {
  const docs = new Map<string, Data>(Object.entries(initial));
  let autoId = 0;

  const segments = (path: string) => path.split("/").filter(Boolean);

  function collRef(path: string): CollRef {
    const parts = segments(path);
    return {
      id: parts[parts.length - 1],
      path,
      parent: parts.length > 1 ? docRef(parts.slice(0, -1).join("/")) : null,
    };
  }

  function snapOf(path: string): Snap {
    const data = docs.get(path);
    return { id: segments(path).pop() as string, exists: data !== undefined, ref: docRef(path), data: () => data };
  }

  function applyUpdate(path: string, data: unknown) {
    const cur = docs.get(path);
    if (!cur) throw Object.assign(new Error(`NOT_FOUND ${path}`), { code: 5 });
    // Nur die Objekt-Form; die FieldPath-Form (Token-Cleanup) ist hier ein No-op.
    if (data && typeof data === "object" && data.constructor === Object) docs.set(path, { ...cur, ...(data as Data) });
  }

  function docRef(path: string): DocRef {
    const parts = segments(path);
    return {
      id: parts[parts.length - 1],
      path,
      parent: collRef(parts.slice(0, -1).join("/")),
      get: async () => snapOf(path),
      create: async (data) => {
        if (docs.has(path)) throw Object.assign(new Error(`ALREADY_EXISTS ${path}`), { code: 6 });
        docs.set(path, data);
      },
      set: async (data) => {
        docs.set(path, data);
      },
      update: async (data) => applyUpdate(path, data),
    };
  }

  /** Direkte Kinder-Docs einer Collection. */
  function childrenOf(path: string): string[] {
    const depth = segments(path).length + 1;
    return [...docs.keys()].filter((k) => k.startsWith(`${path}/`) && segments(k).length === depth);
  }

  function query(paths: () => string[], filters: [string, unknown][] = []) {
    return {
      where: (field: string, op: string, value: unknown) => {
        if (op !== "==") throw new Error(`memoryFirestore: Operator ${op} nicht unterstützt`);
        return query(paths, [...filters, [field, value]]);
      },
      get: async () => {
        const matching = paths().filter((p) => filters.every(([f, v]) => docs.get(p)?.[f] === v));
        return { docs: matching.map(snapOf), size: matching.length, empty: matching.length === 0 };
      },
    };
  }

  const db = {
    doc: (path: string) => docRef(path),
    collection: (path: string) => ({
      ...collRef(path),
      ...query(() => childrenOf(path)),
      doc: (id: string) => docRef(`${path}/${id}`),
      add: async (data: Data) => {
        const ref = docRef(`${path}/auto${++autoId}`);
        docs.set(ref.path, data);
        return ref;
      },
    }),
    collectionGroup: (id: string) =>
      query(() =>
        [...docs.keys()].filter((k) => {
          const parts = segments(k);
          return parts.length % 2 === 0 && parts[parts.length - 2] === id;
        }),
      ),
    getAll: async (...refs: DocRef[]) => refs.map((r) => snapOf(r.path)),
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      options.beforeTransaction?.(docs);
      const writes: (() => void)[] = [];
      const tx = {
        get: async (ref: DocRef) => snapOf(ref.path),
        update: (ref: DocRef, data: Data) => {
          writes.push(() => applyUpdate(ref.path, data));
          return tx;
        },
        set: (ref: DocRef, data: Data) => {
          writes.push(() => docs.set(ref.path, data));
          return tx;
        },
        delete: (ref: DocRef) => {
          writes.push(() => docs.delete(ref.path));
          return tx;
        },
      };
      const result = await fn(tx);
      writes.forEach((w) => w());
      return result;
    },
    // Batch wie die Transaktion: Writes erst beim Commit.
    batch: () => {
      const writes: (() => void)[] = [];
      const batch = {
        set: (ref: DocRef, data: Data) => {
          writes.push(() => docs.set(ref.path, data));
          return batch;
        },
        update: (ref: DocRef, data: Data) => {
          writes.push(() => applyUpdate(ref.path, data));
          return batch;
        },
        commit: async () => {
          writes.forEach((w) => w());
        },
      };
      return batch;
    },
  };

  /** Alle Docs direkt unter `path` (z. B. groups/g1/_push) als Pfad → Daten. */
  const list = (path: string) => Object.fromEntries(childrenOf(path).map((p) => [p, docs.get(p)]));

  return { db: db as unknown as Firestore, docs, list };
}

/** Versand-Attrappe: merkt sich jede Multicast-Nachricht, alle Tokens „zugestellt“. */
export function captureTransport() {
  const messages: MulticastMessage[] = [];
  const groups: string[] = [];
  const transportFor = (groupId: string) => async (message: MulticastMessage): Promise<BatchResponse> => {
    messages.push(message);
    groups.push(groupId);
    return {
      successCount: message.tokens.length,
      failureCount: 0,
      responses: message.tokens.map(() => ({ success: true, messageId: "test" })),
    };
  };
  return { messages, groups, transportFor };
}
