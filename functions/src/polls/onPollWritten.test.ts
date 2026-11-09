import { describe, expect, it } from "vitest";
import { captureTransport, memoryFirestore } from "../../test/memoryFirestore";
import { HOUR, T0, activePoll, pollSeed } from "../../test/pollFixture";
import { handlePollWrite, onPollWritten } from "./onPollWritten";

function setup(extra: Record<string, Record<string, unknown>> = {}) {
  const store = memoryFirestore(pollSeed(extra));
  const transport = captureTransport();
  const deps = { db: store.db, transportFor: transport.transportFor };
  const write = (before: unknown, after: unknown, now = T0, giftId = "gift1") =>
    handlePollWrite(deps, { groupId: "g1", giftId, before, after, now });
  return { ...store, ...transport, write };
}

describe("handlePollWrite (onPollWritten)", () => {
  it("Start: an Wahlberechtigte ohne Starter, nie an Anna, Nicht-Teilnehmer oder Unbekannte", async () => {
    const { write, messages, groups, docs } = setup();
    const res = await write(undefined, activePoll());
    expect(res).toEqual({ sent: 2 });
    expect(messages).toHaveLength(1);
    expect(groups).toEqual(["g1"]);
    // Ben = Starter; Anna + Annas Gerät t-shared (auch unter Christof) gesperrt;
    // Max kein Teilnehmer; u-anon ohne Identität.
    expect([...messages[0].tokens].sort()).toEqual(["t-christof", "t-lea"]);
    expect(messages[0].data).toEqual({
      v: "1",
      type: "poll_started",
      kind: "poll_started",
      groupId: "g1",
      giftId: "gift1",
      url: "/g/g1/gift/gift1?vote=1",
      tag: "gm-poll-g1-gift1",
      renotify: "1",
      title: "🗳️ Abstimmung für Annas Geschenk",
      body: "Ben hat 2 Ideen zur Wahl gestellt – endet Fr 10:00.",
    });
    expect(messages[0].webpush?.headers).toEqual({ Urgency: "high", TTL: String(48 * 3600) });
    expect(messages[0].notification).toBeUndefined(); // Data-only
    expect(docs.has(`groups/g1/_push/poll_started-gift1-${T0}`)).toBe(true);
  });

  it("idempotent: derselbe Trigger zweimal → nur ein Push", async () => {
    const { write, messages } = setup();
    await write(undefined, activePoll());
    const again = await write(undefined, activePoll());
    expect(again).toEqual({ sent: 0, skipped: "duplicate" });
    expect(messages).toHaveLength(1);
  });

  it("kein Push bei Stimme, Verlängern, Beenden (kein Ergebnis-Push) oder Verwerfen", async () => {
    const { write, messages, docs } = setup();
    const running = activePoll();
    expect(await write(running, activePoll({ votes: { lea: ["s1"] } }))).toEqual({ sent: 0, skipped: "no-start" });
    expect(await write(running, activePoll({ endsAt: T0 + 72 * HOUR }))).toEqual({ sent: 0, skipped: "no-start" });
    expect(
      await write(running, activePoll({ status: "closed", closedAt: T0 + HOUR, closedBy: "ben", closedReason: "manual" })),
    ).toEqual({ sent: 0, skipped: "no-start" });
    expect(await write(running, undefined)).toEqual({ sent: 0, skipped: "no-start" });
    expect(messages).toHaveLength(0);
    expect([...docs.keys()].some((k) => k.includes("/_push/"))).toBe(false);
  });

  it("neue Runde (anderes startedAt) pusht erneut mit eigenem Marker", async () => {
    const { write, messages, docs } = setup();
    await write(undefined, activePoll());
    const round2 = T0 + 50 * HOUR;
    const res = await write(
      activePoll({ status: "closed", closedAt: T0 + 48 * HOUR }),
      activePoll({ startedAt: round2, startedBy: "christof", endsAt: round2 + 24 * HOUR }),
      round2,
    );
    expect(res).toEqual({ sent: 2 });
    expect(messages).toHaveLength(2);
    expect([...messages[1].tokens].sort()).toEqual(["t-ben", "t-lea"]); // jetzt ist Christof der Starter
    expect(messages[1].data?.body).toBe("Christof hat 2 Ideen zur Wahl gestellt – endet morgen 12:00.");
    expect(docs.has(`groups/g1/_push/poll_started-gift1-${round2}`)).toBe(true);
  });

  it("Opt-in: notifyPolls überstimmt notifyStack, fehlt es, zählt notifyStack", async () => {
    const { write, messages } = setup({
      "groups/g1/members/u-lea": { identityPersonId: "lea", notifyStack: true, notifyPolls: false },
      "groups/g1/members/u-christof": { identityPersonId: "christof" },
    });
    const res = await write(undefined, activePoll({ startedBy: "lea" }));
    // Ben: nur notifyPolls=true → ja; Lea: Starterin (und notifyPolls=false); Christof: kein Opt-in.
    expect(res).toEqual({ sent: 1 });
    expect(messages[0].tokens).toEqual(["t-ben"]);
  });

  it("alter Client ohne startedBy/endsAt: alle Wahlberechtigten, Frist = Start + 48 Std", async () => {
    const { write, messages } = setup();
    await write(undefined, { status: "active", startedAt: T0, votes: {} });
    expect([...messages[0].tokens].sort()).toEqual(["t-ben", "t-christof", "t-lea"]);
    expect(messages[0].data?.body).toBe("2 Ideen stehen zur Wahl – endet Fr 10:00.");
    expect(messages[0].webpush?.headers?.TTL).toBe(String(48 * 3600));
  });

  it("nichts, wenn das Geschenk fehlt, nicht offen ist oder die Runde schon abgelaufen ist", async () => {
    const { write, messages, docs } = setup({
      "groups/g1/gifts/gift2": { personId: "anna", status: "confirmed", participantIds: ["ben", "lea"] },
    });
    expect(await write(undefined, activePoll(), T0, "gift2")).toEqual({ sent: 0, skipped: "gift-not-open" });
    expect(await write(undefined, activePoll(), T0, "ghost")).toEqual({ sent: 0, skipped: "gift-not-open" });
    expect(await write(undefined, activePoll({ endsAt: T0 + HOUR }), T0 + 2 * HOUR)).toEqual({
      sent: 0,
      skipped: "not-running",
    });
    expect(messages).toHaveLength(0);
    expect([...docs.keys()].some((k) => k.includes("/_push/"))).toBe(false);
  });

  it("ohne Wahlberechtigte (nur die beschenkte Person eingetragen) kein Marker, kein Push", async () => {
    const { write, messages, docs } = setup({
      "groups/g1/gifts/gift1": { personId: "anna", status: "open", participantIds: ["anna"] },
    });
    expect(await write(undefined, activePoll())).toEqual({ sent: 0, skipped: "no-voters" });
    expect(messages).toHaveLength(0);
    expect([...docs.keys()].some((k) => k.includes("/_push/"))).toBe(false);
  });
});

describe("onPollWritten – Zustellung (R10)", () => {
  it("läuft mit retry, sonst holt niemand einen gescheiterten Start-Push nach", () => {
    const endpoint = (onPollWritten as unknown as { __endpoint: { eventTrigger: { retry: boolean } } }).__endpoint;
    expect(endpoint.eventTrigger.retry).toBe(true);
  });
});

describe("onPollWritten – Drosselung je Geschenk (S2)", () => {
  const MIN = 60_000;
  const round = (startedAt: number) => activePoll({ startedAt, endsAt: startedAt + 48 * HOUR });

  it("zweiter Start im selben Fenster bleibt stumm", async () => {
    const { write, messages } = setup();
    expect((await write(undefined, round(T0), T0)).sent).toBeGreaterThan(0);
    const res = await write(undefined, round(T0 + 1000), T0 + 1000);
    expect(res).toEqual({ sent: 0, skipped: "throttled" });
    expect(messages).toHaveLength(1);
  });

  it("nach dem Fenster geht wieder ein Start-Push raus", async () => {
    const { write, messages } = setup();
    await write(undefined, round(T0), T0);
    const later = T0 + 11 * MIN;
    expect((await write(undefined, round(later), later)).sent).toBeGreaterThan(0);
    expect(messages).toHaveLength(2);
  });
});
