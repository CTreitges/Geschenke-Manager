import type { Firestore } from "firebase-admin/firestore";
import type { BatchResponse, MulticastMessage } from "firebase-admin/messaging";
import { describe, expect, it } from "vitest";
import { runTestPush, testPushData } from "./testPush";

function fakeDb(tokenDocs: Record<string, Record<string, unknown>>) {
  const removed: string[] = [];
  const db = {
    doc: (path: string) => ({
      path,
      update: async () => {
        removed.push(path);
      },
    }),
    getAll: async (...refs: { path: string }[]) =>
      refs.map((r) => {
        const id = r.path.split("/")[1];
        return { id, exists: id in tokenDocs, data: () => tokenDocs[id] };
      }),
  };
  return { db: db as unknown as Firestore, removed };
}

describe("testPushData", () => {
  it("führt zu den Einstellungen und ersetzt vorherige Test-Meldungen", () => {
    expect(testPushData("g1")).toMatchObject({ type: "test", url: "/settings", tag: "gm-test", groupId: "g1" });
  });
});

describe("runTestPush", () => {
  it("schickt an alle Tokens des Aufrufers und meldet die Anzahl", async () => {
    const { db } = fakeDb({ u1: { a: {}, b: {} }, u2: { c: {} } });
    const sent: MulticastMessage[] = [];
    const transport = async (m: MulticastMessage): Promise<BatchResponse> => {
      sent.push(m);
      return {
        successCount: m.tokens.length,
        failureCount: 0,
        responses: m.tokens.map(() => ({ success: true, messageId: "x" })),
      };
    };
    await expect(runTestPush(db, "u1", "g1", transport)).resolves.toEqual({ sent: 2, failed: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0].tokens).toEqual(["a", "b"]);
    expect(sent[0].data?.type).toBe("test");
    expect(sent[0].webpush?.headers?.Urgency).toBe("high");
  });

  it("ohne Tokens: 0, kein Versand", async () => {
    const { db } = fakeDb({});
    let calls = 0;
    const transport = async (): Promise<BatchResponse> => {
      calls++;
      return { successCount: 0, failureCount: 0, responses: [] };
    };
    await expect(runTestPush(db, "u1", "g1", transport)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(calls).toBe(0);
  });

  it("räumt abgemeldete Tokens auf", async () => {
    const { db, removed } = fakeDb({ u1: { dead: {}, ok: {} } });
    const transport = async (m: MulticastMessage): Promise<BatchResponse> => ({
      successCount: 1,
      failureCount: 1,
      responses: m.tokens.map((t) =>
        t === "dead"
          ? { success: false, error: { code: "messaging/registration-token-not-registered" } as never }
          : { success: true, messageId: "x" },
      ),
    });
    await expect(runTestPush(db, "u1", "g1", transport)).resolves.toEqual({ sent: 1, failed: 1 });
    expect(removed).toEqual(["pushTokens/u1"]);
  });
});
