import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { captureTransport, memoryFirestore } from "../../test/memoryFirestore";
import { T0, activePoll, pollSeed } from "../../test/pollFixture";
import { normalizePoll } from "../shared/poll";
import { pollMarkerId } from "./pollPush";
import { sendPollPush } from "./sendPollPush";

/** memoryFirestore plus doc().delete() (Marker freigeben). */
function setup() {
  const store = memoryFirestore(pollSeed());
  const base = store.db as unknown as { doc: (path: string) => Record<string, unknown> };
  const db = {
    ...(store.db as unknown as Record<string, unknown>),
    doc: (path: string) => ({ ...base.doc(path), delete: async () => void store.docs.delete(path) }),
  } as unknown as Firestore;
  return { ...store, db };
}

const gift = { personId: "anna", status: "open", participantIds: ["anna", "ben", "christof", "lea"] };
const poll = normalizePoll(activePoll());
const input = { groupId: "g1", giftId: "gift1", gift, poll, now: T0 };

const failingTransport = () => async () => {
  throw Object.assign(new Error("FCM: Auth fehlgeschlagen"), { code: "app/invalid-credential" });
};

describe("sendPollPush – Marker bei Fehlern (PUSH-04)", () => {
  for (const kind of ["poll_started", "poll_reminder"] as const) {
    const marker = `groups/g1/_push/${pollMarkerId(kind, "gift1", T0)}`;

    it(`${kind}: Versand wirft → Marker wieder frei, nächster Lauf sendet`, async () => {
      const { db, docs } = setup();
      await expect(sendPollPush({ db, transportFor: failingTransport }, { ...input, kind })).rejects.toThrow(
        "Auth fehlgeschlagen",
      );
      expect(docs.has(marker)).toBe(false);

      const transport = captureTransport();
      const res = await sendPollPush({ db, transportFor: transport.transportFor }, { ...input, kind });
      expect(res.sent).toBeGreaterThan(0);
      expect(transport.messages).toHaveLength(1);
      expect(docs.has(marker)).toBe(true);
    });
  }

  it("Laden wirft nach dem Claim → Marker ebenfalls frei", async () => {
    const { db, docs } = setup();
    const broken = {
      ...(db as unknown as Record<string, unknown>),
      collection: () => {
        throw new Error("Firestore nicht erreichbar");
      },
    } as unknown as Firestore;
    await expect(sendPollPush({ db: broken }, { ...input, kind: "poll_started" })).rejects.toThrow(
      "nicht erreichbar",
    );
    expect(docs.has(`groups/g1/_push/${pollMarkerId("poll_started", "gift1", T0)}`)).toBe(false);
  });

  it("erfolgreicher Versand: zweiter Lauf bleibt Duplikat (Marker bleibt)", async () => {
    const { db } = setup();
    const transport = captureTransport();
    await sendPollPush({ db, transportFor: transport.transportFor }, { ...input, kind: "poll_started" });
    const again = await sendPollPush({ db, transportFor: transport.transportFor }, { ...input, kind: "poll_started" });
    expect(again).toEqual({ sent: 0, skipped: "duplicate" });
    expect(transport.messages).toHaveLength(1);
  });
});
