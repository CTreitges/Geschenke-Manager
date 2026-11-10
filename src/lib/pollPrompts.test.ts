import { describe, expect, it } from "vitest";
import type { PollDoc } from "@shared/poll";
import {
  autoPollSheet,
  linkedPollSheet,
  markPrompted,
  markPushAsked,
  openPollSheetKind,
  PUSH_ASK_INTERVAL_MS,
  pushAskKey,
  shouldAskPush,
  votePromptKey,
  wasPrompted,
  type StorageLike,
} from "./pollPrompts";

const HOUR = 3_600_000;
const NOW = Date.parse("2026-09-30T12:00:00+02:00");

function memStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const throwing: StorageLike = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceeded");
  },
};

const gift = { personId: "anna", status: "open" as const, participantIds: ["ben", "lena", "max"] };
const running: PollDoc = { status: "active", startedAt: NOW - HOUR, endsAt: NOW + HOUR, votes: { lena: ["s1"] } };
const expired: PollDoc = { ...running, endsAt: NOW - 1 };
const ideaIds = ["s1", "s2"];

describe("Keys", () => {
  it("enthalten Gruppe, Geschenk und Runde", () => {
    expect(votePromptKey("demo", "anna_2026", 123)).toBe("gm:vote-prompted:demo:anna_2026:123");
    expect(pushAskKey("demo")).toBe("gm:push-ask:demo");
  });
});

describe("wasPrompted / markPrompted", () => {
  it("merkt sich die Runde im Storage", () => {
    const s = memStorage();
    const key = votePromptKey("g", "x", 1);
    expect(wasPrompted(key, s)).toBe(false);
    markPrompted(key, s);
    expect(wasPrompted(key, s)).toBe(true);
    expect(s.data.get(key)).toBe("1");
  });

  it("werfender Storage: Speicher-Fallback statt Dauer-Aufpoppen", () => {
    const key = votePromptKey("g", "throw", 2);
    expect(() => markPrompted(key, throwing)).not.toThrow();
    expect(wasPrompted(key, throwing)).toBe(true);
  });
});

describe("shouldAskPush", () => {
  it("nur wenn Push aus ist", () => {
    const s = memStorage();
    expect(shouldAskPush("g", "off", NOW, s)).toBe(true);
    for (const state of ["on", "denied", "unsupported", "needs-install", null] as const) {
      expect(shouldAskPush("g", state, NOW, s)).toBe(false);
    }
  });

  it("höchstens 1× pro Gruppe in 30 Tagen", () => {
    const s = memStorage();
    markPushAsked("g", NOW, s);
    expect(shouldAskPush("g", "off", NOW + PUSH_ASK_INTERVAL_MS - 1, s)).toBe(false);
    expect(shouldAskPush("g", "off", NOW + PUSH_ASK_INTERVAL_MS, s)).toBe(true);
    expect(shouldAskPush("andere", "off", NOW, s)).toBe(true);
  });
});

describe("linkedPollSheet (?vote=1)", () => {
  it("laufend → VoteSheet, vorbei → Ergebnis", () => {
    expect(linkedPollSheet({ gift, poll: running, myId: "ben", now: NOW })).toBe("vote");
    expect(linkedPollSheet({ gift, poll: expired, myId: "ben", now: NOW })).toBe("decision");
    expect(linkedPollSheet({ gift, poll: { ...running, status: "closed" }, myId: "ben", now: NOW })).toBe("decision");
  });

  it("nie für Beschenkte, ohne Identität, Nicht-Wahlberechtigte oder entschiedene Geschenke", () => {
    expect(linkedPollSheet({ gift, poll: running, myId: "anna", now: NOW })).toBeNull();
    expect(linkedPollSheet({ gift, poll: running, myId: null, now: NOW })).toBeNull();
    expect(linkedPollSheet({ gift, poll: running, myId: "sophie", now: NOW })).toBeNull();
    expect(linkedPollSheet({ gift: { ...gift, status: "confirmed" }, poll: running, myId: "ben", now: NOW })).toBeNull();
    expect(linkedPollSheet({ gift, poll: null, myId: "ben", now: NOW })).toBeNull();
  });
});

describe("autoPollSheet", () => {
  const ctx = { gift, poll: running, now: NOW, ideaIds, votePrompted: false, resultPrompted: false };

  it("VoteSheet einmal pro Runde, solange ich 0 Stimmen habe", () => {
    expect(autoPollSheet({ ...ctx, myId: "ben" })).toBe("vote");
    expect(autoPollSheet({ ...ctx, myId: "ben", votePrompted: true })).toBeNull();
    expect(autoPollSheet({ ...ctx, myId: "lena" })).toBeNull(); // hat gewählt
  });

  it("Stimmen für gelöschte Ideen zählen nicht", () => {
    const poll: PollDoc = { ...running, votes: { ben: ["weg"] } };
    expect(autoPollSheet({ ...ctx, poll, myId: "ben" })).toBe("vote");
  });

  it("Ergebnis einmal pro Runde für Wahlberechtigte", () => {
    expect(autoPollSheet({ ...ctx, poll: expired, myId: "lena" })).toBe("decision");
    expect(autoPollSheet({ ...ctx, poll: expired, myId: "lena", resultPrompted: true })).toBeNull();
    expect(autoPollSheet({ ...ctx, poll: expired, myId: "sophie" })).toBeNull();
  });

  it("nie für die beschenkte Person", () => {
    const g = { ...gift, participantIds: [...gift.participantIds, "anna"] };
    expect(autoPollSheet({ ...ctx, gift: g, myId: "anna" })).toBeNull();
  });
});

describe("openPollSheetKind", () => {
  it("läuft → VoteSheet, abgelaufen oder beendet → Ergebnis", () => {
    expect(openPollSheetKind(gift, running, NOW)).toBe("vote");
    expect(openPollSheetKind(gift, expired, NOW)).toBe("decision");
    expect(openPollSheetKind(gift, { ...running, status: "closed" }, NOW)).toBe("decision");
  });

  it("genau an der Frist wechselt das offene Sheet ins Ergebnis", () => {
    expect(openPollSheetKind(gift, running, NOW + HOUR - 1)).toBe("vote");
    expect(openPollSheetKind(gift, running, NOW + HOUR)).toBe("decision");
  });

  it("verworfen (kein Doc) oder Geschenk entschieden → nichts mehr zu zeigen", () => {
    expect(openPollSheetKind(gift, null, NOW)).toBeNull();
    expect(openPollSheetKind({ status: "confirmed" }, running, NOW)).toBeNull();
    expect(openPollSheetKind({ status: "received" }, expired, NOW)).toBeNull();
  });
});
