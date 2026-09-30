import type { Firestore } from "firebase-admin/firestore";
import type { BatchResponse, MulticastMessage } from "firebase-admin/messaging";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildMessages,
  defaultTransport,
  invalidTokens,
  MAX_TTL_SECONDS,
  sendAndCleanup,
  toDataStrings,
  type Transport,
} from "./send";

/** Minimaler Firestore-Ersatz: merkt sich update()/add()-Aufrufe. */
function fakeDb() {
  const updates: { path: string; field: string }[] = [];
  const adds: { path: string; data: Record<string, unknown> }[] = [];
  const db = {
    doc: (path: string) => ({
      update: async (field: { toString(): string }) => {
        updates.push({ path, field: field.toString() });
      },
    }),
    collection: (path: string) => ({
      add: async (data: Record<string, unknown>) => {
        adds.push({ path, data });
      },
    }),
  };
  return { db: db as unknown as Firestore, updates, adds };
}

function respond(codes: (string | null)[]): BatchResponse {
  const responses = codes.map((code) =>
    code === null
      ? { success: true, messageId: "m" }
      : { success: false, error: { code, message: code } as never },
  );
  const successCount = responses.filter((r) => r.success).length;
  return { successCount, failureCount: codes.length - successCount, responses };
}

describe("toDataStrings", () => {
  it("wandelt alle Werte in Strings, lässt leere weg und setzt v=1", () => {
    expect(toDataStrings({ a: 1, b: true, c: "x", d: undefined, e: null })).toEqual({
      v: "1",
      a: "1",
      b: "true",
      c: "x",
    });
  });
});

describe("buildMessages", () => {
  it("Data-only mit Urgency/TTL-Headern, ohne notification-Block", () => {
    const [m] = buildMessages(["t1", "t2"], { title: "Hi" }, "high", 3600);
    expect(m.tokens).toEqual(["t1", "t2"]);
    expect(m.data).toEqual({ v: "1", title: "Hi" });
    expect(m.webpush?.headers).toEqual({ Urgency: "high", TTL: "3600" });
    expect("notification" in m).toBe(false);
  });

  it("teilt in Blöcke zu 500 Tokens und entfernt Duplikate", () => {
    const tokens = Array.from({ length: 1001 }, (_, i) => `t${i}`);
    const msgs = buildMessages([...tokens, "t0"], {});
    expect(msgs.map((m) => m.tokens.length)).toEqual([500, 500, 1]);
  });

  it("klemmt die TTL auf 0 … 4 Wochen", () => {
    expect(buildMessages(["t"], {}, "normal", -5)[0].webpush?.headers?.TTL).toBe("0");
    expect(buildMessages(["t"], {}, "normal", 1e9)[0].webpush?.headers?.TTL).toBe(
      String(MAX_TTL_SECONDS),
    );
  });

  it("ohne Tokens keine Nachricht", () => {
    expect(buildMessages([], { a: "b" })).toEqual([]);
  });
});

describe("invalidTokens", () => {
  it("meldet nur abgemeldete/ungültige Tokens, nicht andere Fehler", () => {
    const res = respond([
      null,
      "messaging/registration-token-not-registered",
      "messaging/internal-error",
      "messaging/invalid-registration-token",
    ]);
    expect(invalidTokens(["a", "b", "c", "d"], res)).toEqual(["b", "d"]);
  });
});

describe("sendAndCleanup", () => {
  it("sendet und entfernt ungültige Tokens bei allen UIDs, unter denen sie liegen", async () => {
    const { db, updates } = fakeDb();
    const sent: MulticastMessage[] = [];
    const transport: Transport = async (m) => {
      sent.push(m);
      return respond(m.tokens.map((t) => (t === "dead" ? "messaging/registration-token-not-registered" : null)));
    };
    const result = await sendAndCleanup(
      db,
      {
        groupId: "g1",
        tokens: ["ok", "dead"],
        tokensByUid: { u1: ["ok", "dead"], u2: ["dead"], u3: ["other"] },
        data: { type: "test" },
      },
      transport,
    );
    expect(sent).toHaveLength(1);
    expect(result).toEqual({ sent: 1, failed: 1, removed: 2 });
    expect(updates.map((u) => u.path).sort()).toEqual(["pushTokens/u1", "pushTokens/u2"]);
    expect(updates.every((u) => u.field.includes("dead"))).toBe(true);
  });

  it("ohne Tokens wird nichts gesendet", async () => {
    const { db } = fakeDb();
    let calls = 0;
    const result = await sendAndCleanup(
      db,
      { groupId: "g1", tokens: [], tokensByUid: {}, data: {} },
      async (m) => {
        calls++;
        return respond(m.tokens.map(() => null));
      },
    );
    expect(calls).toBe(0);
    expect(result).toEqual({ sent: 0, failed: 0, removed: 0 });
  });
});

describe("defaultTransport im Emulator", () => {
  const before = process.env.FUNCTIONS_EMULATOR;
  afterEach(() => {
    if (before === undefined) delete process.env.FUNCTIONS_EMULATOR;
    else process.env.FUNCTIONS_EMULATOR = before;
  });

  it("schreibt nach groups/{gid}/_debugPush statt zu senden", async () => {
    process.env.FUNCTIONS_EMULATOR = "true";
    const { db, adds } = fakeDb();
    const res = await defaultTransport(db, "g1")({
      tokens: ["a", "b"],
      data: { v: "1", type: "test" },
    });
    expect(res.successCount).toBe(2);
    expect(adds).toHaveLength(1);
    expect(adds[0].path).toBe("groups/g1/_debugPush");
    expect(adds[0].data.tokens).toEqual(["a", "b"]);
  });
});
