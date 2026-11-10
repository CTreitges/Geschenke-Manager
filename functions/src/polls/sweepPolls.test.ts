import { describe, expect, it } from "vitest";
import { captureTransport, memoryFirestore, type MemoryFirestoreOptions } from "../../test/memoryFirestore";
import { HOUR, MIN, T0, activePoll, pollSeed } from "../../test/pollFixture";
import { normalizePoll, type GiftLike } from "../shared/poll";
import { runPollSweep, sweepAction } from "./sweepPolls";

// Runde: Mi 30.09. 10:00 → Fr 02.10. 10:00 (48 Std). Erinnerung: 12 Std vorher
// wäre Do 22:00 (Ruhezeit) → vorgezogen auf Do 01.10. 21:30.
const END = T0 + 48 * HOUR;
const at = (iso: string) => Date.parse(iso);
const DUE = at("2026-10-01T21:30:00+02:00");

// Lea hat gültig gewählt, Christofs Stimme gilt einer gelöschten Idee.
const VOTES = { lea: ["s1"], christof: ["s-geloescht"] };

function setup(extra: Record<string, Record<string, unknown>> = {}, options: MemoryFirestoreOptions = {}) {
  const store = memoryFirestore(
    pollSeed({ "groups/g1/polls/gift1": activePoll({ votes: VOTES }), ...extra }),
    options,
  );
  const transport = captureTransport();
  const sweep = (now: number) => runPollSweep({ db: store.db, transportFor: transport.transportFor }, now);
  const poll = (path = "groups/g1/polls/gift1") => store.docs.get(path) as Record<string, unknown>;
  return { ...store, ...transport, sweep, poll };
}

describe("sweepAction", () => {
  const gift: GiftLike = { personId: "anna", status: "open", participantIds: ["ben", "lea"] };
  const p = normalizePoll(activePoll());

  it("schließt Waisen und Abstimmungen erledigter Geschenke", () => {
    expect(sweepAction(p, null, T0)).toEqual({ kind: "close", reason: "orphan" });
    expect(sweepAction(p, { ...gift, status: "confirmed" }, T0)).toEqual({ kind: "close", reason: "gift-confirmed" });
    expect(sweepAction(p, { ...gift, status: "received" }, T0)).toEqual({ kind: "close", reason: "gift-received" });
  });

  it("schließt genau ab endsAt wegen Zeitablauf", () => {
    expect(sweepAction(p, gift, END - 1)).not.toEqual({ kind: "close", reason: "timeout" });
    expect(sweepAction(p, gift, END)).toEqual({ kind: "close", reason: "timeout" });
  });

  it("erinnert ab reminderDueAt, aber nicht in der Ruhezeit", () => {
    expect(sweepAction(p, gift, DUE - MIN)).toEqual({ kind: "none" });
    expect(sweepAction(p, gift, DUE)).toEqual({ kind: "remind" });
    expect(sweepAction(p, gift, at("2026-10-01T22:00:00+02:00"))).toEqual({ kind: "none" });
    expect(sweepAction(p, gift, at("2026-10-02T08:00:00+02:00"))).toEqual({ kind: "remind" });
  });

  it("ohne gültige Frist (alter Client) endet die Runde nach 48 Std, geschlossene Polls bleiben", () => {
    const legacy = normalizePoll({ status: "active", startedAt: T0, endsAt: T0 - HOUR, votes: {} });
    expect(sweepAction(legacy, gift, END - 1)).not.toEqual({ kind: "close", reason: "timeout" });
    expect(sweepAction(legacy, gift, T0 + 400 * HOUR)).toEqual({ kind: "close", reason: "timeout" });
    // Beginn unbekannt → gilt als abgelaufen und wird geschlossen.
    expect(sweepAction(normalizePoll({ status: "active", votes: {} }), gift, T0)).toEqual({ kind: "close", reason: "timeout" });
    expect(sweepAction(normalizePoll(activePoll({ status: "closed" })), null, END + HOUR)).toEqual({ kind: "none" });
  });
});

describe("runPollSweep", () => {
  it("vor dem Erinnerungszeitpunkt passiert nichts", async () => {
    const { sweep, messages, list, poll } = setup();
    const stats = await sweep(DUE - 5 * MIN);
    expect(stats).toMatchObject({ active: 1, legacy: 0, reminded: 0, sent: 0, closed: {} });
    expect(messages).toHaveLength(0);
    expect(list("groups/g1/_push")).toEqual({});
    expect(poll().status).toBe("active");
  });

  it("Erinnerung einmal an alle Wahlberechtigten ohne gültige Stimme", async () => {
    const { sweep, messages, docs } = setup();
    const now = DUE + 2 * MIN; // Do 21:32
    const stats = await sweep(now);
    expect(stats).toMatchObject({ reminded: 1, sent: 2 });
    expect(messages).toHaveLength(1);
    // Ben (Starter, ohne Stimme) + Christof (Stimme für gelöschte Idee zählt nicht).
    // Nicht: Lea (hat gewählt), Anna + t-shared (beschenkt), Max (kein Teilnehmer), u-anon.
    expect([...messages[0].tokens].sort()).toEqual(["t-ben", "t-christof"]);
    expect(messages[0].data).toMatchObject({
      type: "poll_reminder",
      kind: "poll_reminder",
      title: "⏱ Noch 12 Std zum Abstimmen",
      body: "Für Annas Geschenk fehlt noch deine Stimme.",
      url: "/g/g1/gift/gift1?vote=1",
      tag: "gm-poll-g1-gift1",
    });
    expect(messages[0].webpush?.headers).toEqual({ Urgency: "high", TTL: String((END - now) / 1000) });
    expect(docs.has(`groups/g1/_push/poll_reminder-gift1-${T0}`)).toBe(true);
  });

  it("idempotent: weitere Läufe (auch doppelt) schicken keine zweite Erinnerung", async () => {
    const { sweep, messages } = setup();
    await sweep(DUE + 2 * MIN);
    const again = await sweep(DUE + 2 * MIN);
    const later = await sweep(DUE + 7 * MIN);
    expect(again).toMatchObject({ reminded: 0, sent: 0 });
    expect(later).toMatchObject({ reminded: 0, sent: 0 });
    expect(messages).toHaveLength(1);
  });

  it("Ruhezeit: ein verspäteter Lauf um 23 Uhr wartet, um 8 Uhr geht die Erinnerung raus", async () => {
    const { sweep, messages, list } = setup();
    expect(await sweep(at("2026-10-01T23:00:00+02:00"))).toMatchObject({ reminded: 0 });
    expect(await sweep(at("2026-10-02T03:00:00+02:00"))).toMatchObject({ reminded: 0 });
    expect(messages).toHaveLength(0);
    expect(list("groups/g1/_push")).toEqual({});

    await sweep(at("2026-10-02T08:00:00+02:00"));
    expect(messages).toHaveLength(1);
    expect(messages[0].data?.title).toBe("⏱ Noch 2 Std zum Abstimmen");
  });

  it("abgelaufen → stumm geschlossen (timeout, closedAt = Ende), Stimmen bleiben", async () => {
    const { sweep, messages, poll } = setup();
    const stats = await sweep(END + 3 * MIN);
    expect(stats.closed).toEqual({ timeout: 1 });
    expect(poll()).toMatchObject({ status: "closed", closedAt: END, closedReason: "timeout", votes: VOTES });
    expect(poll().closedBy).toBeUndefined();
    expect(messages).toHaveLength(0); // kein Ergebnis-Push
    // Nächster Lauf findet die Abstimmung nicht mehr (status != active).
    expect(await sweep(END + 8 * MIN)).toMatchObject({ active: 0, closed: {} });
  });

  it("Alt-Runde ohne gültige Frist wird nach Start + 48 Std geschlossen (Regression KOR-03)", async () => {
    const { sweep, poll, messages } = setup({
      "groups/g1/polls/gift1": { status: "active", startedAt: T0, endsAt: T0 - HOUR, votes: VOTES },
    });
    expect(await sweep(T0 + 400 * HOUR)).toMatchObject({ closed: { timeout: 1 } });
    expect(poll()).toMatchObject({ status: "closed", closedAt: T0 + 48 * HOUR, closedReason: "timeout" });
    expect(messages).toHaveLength(0);
  });

  it("Legacy-Top-Level /polls und fremde Pfade bleiben unberührt", async () => {
    const { sweep, poll, messages } = setup({
      "polls/legacy1": activePoll({ endsAt: T0 + HOUR }),
      "groups/g1/gifts/gift1/polls/x": activePoll({ endsAt: T0 + HOUR }),
    });
    const stats = await sweep(END + 3 * MIN);
    expect(stats.legacy).toBe(2);
    expect(poll("polls/legacy1").status).toBe("active");
    expect(poll("groups/g1/gifts/gift1/polls/x").status).toBe("active");
    expect(messages).toHaveLength(0);
  });

  it("Waise (Geschenk gelöscht) und erledigte Geschenke → stumm geschlossen", async () => {
    const now = T0 + HOUR;
    const { sweep, poll, messages } = setup({
      "groups/g1/polls/ghost": activePoll(),
      "groups/g1/gifts/gift2": { personId: "ben", status: "confirmed", participantIds: ["lea", "max"] },
      "groups/g1/polls/gift2": activePoll({ startedBy: "lea" }),
      "groups/g1/gifts/gift3": { personId: "lea", status: "received", participantIds: ["ben", "max"] },
      "groups/g1/polls/gift3": activePoll({ startedBy: "ben" }),
    });
    const stats = await sweep(now);
    expect(stats.closed).toEqual({ orphan: 1, "gift-confirmed": 1, "gift-received": 1 });
    expect(poll("groups/g1/polls/ghost")).toMatchObject({ status: "closed", closedReason: "orphan", closedAt: now });
    expect(poll("groups/g1/polls/gift2")).toMatchObject({ status: "closed", closedReason: "gift-confirmed" });
    expect(poll("groups/g1/polls/gift3")).toMatchObject({ status: "closed", closedReason: "gift-received" });
    expect(poll().status).toBe("active"); // gift1 läuft weiter
    expect(messages).toHaveLength(0);
  });

  it("Verlängern während des Sweeps: die Transaktion schließt nicht", async () => {
    const extendedEnd = END + 24 * HOUR;
    const { sweep, poll } = setup(
      {},
      {
        beforeTransaction: (docs) => {
          const p = docs.get("groups/g1/polls/gift1")!;
          docs.set("groups/g1/polls/gift1", { ...p, endsAt: extendedEnd });
        },
      },
    );
    const stats = await sweep(END + 3 * MIN);
    expect(stats.closed).toEqual({});
    expect(poll()).toMatchObject({ status: "active", endsAt: extendedEnd });
    expect(poll().closedReason).toBeUndefined();
  });

  it("Neustart während des Sweeps (neues startedAt): die neue Runde bleibt offen", async () => {
    const round2 = END + 2 * MIN;
    const { sweep, poll } = setup(
      {},
      {
        beforeTransaction: (docs) => {
          docs.set("groups/g1/polls/gift1", activePoll({ startedAt: round2, endsAt: round2 + 24 * HOUR }));
        },
      },
    );
    const stats = await sweep(END + 3 * MIN);
    expect(stats.closed).toEqual({});
    expect(poll()).toMatchObject({ status: "active", startedAt: round2, votes: {} });
  });

  it("eine kaputte Abstimmung hält die anderen nicht auf", async () => {
    const { db, docs } = memoryFirestore(
      pollSeed({
        "groups/g1/polls/gift1": activePoll(),
        "groups/g2/polls/gx": activePoll(),
      }),
    );
    const realDoc = db.doc.bind(db);
    // Lesefehler nur für groups/g2 simulieren.
    (db as unknown as { doc: (p: string) => unknown }).doc = (path: string) => {
      const ref = realDoc(path);
      if (path.startsWith("groups/g2/gifts/")) {
        return { ...ref, get: async () => Promise.reject(new Error("boom")) };
      }
      return ref;
    };
    const stats = await runPollSweep({ db, transportFor: captureTransport().transportFor }, END + 3 * MIN);
    expect(stats).toMatchObject({ errors: 1, closed: { timeout: 1 } });
    expect(docs.get("groups/g1/polls/gift1")?.status).toBe("closed");
  });
});
