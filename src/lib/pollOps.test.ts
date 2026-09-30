import { describe, expect, it } from "vitest";
import type { PollDoc } from "@shared/poll";
import {
  assertCanStartPoll,
  closeFields,
  extendedEndsAt,
  isPaidByOnlyPatch,
  legacyVoterIds,
  lockMessage,
  newPollDoc,
  POLL_ALREADY_RUNNING,
  PollLockedError,
  startPollBlocker,
  toggledVotes,
} from "./pollOps";

const H = 3_600_000;
const T0 = Date.UTC(2026, 9, 1, 10, 0);

const running: PollDoc = { status: "active", startedAt: T0, endsAt: T0 + 48 * H, votes: { a: ["s1"] } };

describe("newPollDoc", () => {
  it("startet eine frische Runde ohne Stimmen mit Frist", () => {
    expect(newPollDoc("g1", { now: T0, durationMs: 48 * H, startedBy: "ben" })).toEqual({
      giftId: "g1",
      status: "active",
      startedAt: T0,
      startedBy: "ben",
      endsAt: T0 + 48 * H,
      votes: {},
    });
  });
});

describe("closeFields", () => {
  it("manuelles Ende merkt wer und warum", () => {
    expect(closeFields(running, { closedBy: "ben", reason: "manual" }, T0 + H)).toEqual({
      status: "closed",
      closedAt: T0 + H,
      closedReason: "manual",
      closedBy: "ben",
    });
  });

  it("ohne Identität fehlt closedBy (kein undefined-Feld für Firestore)", () => {
    const out = closeFields(running, { closedBy: null, reason: "gift-received" }, T0 + H);
    expect(out).not.toHaveProperty("closedBy");
    expect(out.closedReason).toBe("gift-received");
  });

  it("abgelaufene Frist zählt als timeout mit closedAt = Frist", () => {
    expect(closeFields(running, { closedBy: "ben", reason: "gift-confirmed" }, T0 + 50 * H)).toEqual({
      status: "closed",
      closedAt: T0 + 48 * H,
      closedReason: "timeout",
    });
  });

  it("genau an der Frist ist sie abgelaufen", () => {
    expect(closeFields(running, { reason: "manual" }, T0 + 48 * H).closedReason).toBe("timeout");
  });

  it("Altlast ohne gültige Frist (endsAt ≤ startedAt): Frist = Start + 48 Std", () => {
    const legacy: PollDoc = { status: "active", startedAt: T0, endsAt: T0 - H, votes: {} };
    expect(closeFields(legacy, { reason: "manual" }, T0 + 5 * H).closedReason).toBe("manual");
    expect(closeFields(legacy, { reason: "manual" }, T0 + 99 * H)).toEqual({
      status: "closed",
      closedAt: T0 + 48 * H,
      closedReason: "timeout",
    });
  });
});

describe("extendedEndsAt", () => {
  it("laufend: ab der bisherigen Frist", () => {
    expect(extendedEndsAt(running, H, T0 + H)).toEqual({ endsAt: T0 + 49 * H, reopen: false });
  });

  it("abgelaufen: ab jetzt, nicht ab der alten Frist", () => {
    expect(extendedEndsAt(running, H, T0 + 60 * H)).toEqual({ endsAt: T0 + 61 * H, reopen: false });
  });

  it("vorzeitig beendet: Verlängern rechnet ab jetzt, nicht ab der alten Frist (Regression KOR-07)", () => {
    const manual: PollDoc = { ...running, endsAt: T0 + 168 * H, status: "closed", closedReason: "manual" };
    expect(extendedEndsAt(manual, 24 * H, T0 + 24 * H)).toEqual({ endsAt: T0 + 48 * H, reopen: true });
  });

  it("vom Timer geschlossen: wieder aktiv", () => {
    const closed: PollDoc = { ...running, status: "closed", closedReason: "timeout" };
    expect(extendedEndsAt(closed, 24 * H, T0 + 60 * H)).toEqual({ endsAt: T0 + 84 * H, reopen: true });
  });

  it("ohne Frist (Altlast): ab Start + 48 Std, danach ab jetzt", () => {
    const legacy: PollDoc = { status: "active", startedAt: T0, votes: {} };
    expect(extendedEndsAt(legacy, H, T0 + 5 * H).endsAt).toBe(T0 + 49 * H);
    expect(extendedEndsAt(legacy, H, T0 + 50 * H).endsAt).toBe(T0 + 51 * H);
  });
});

describe("assertCanStartPoll (Regression KOR-04)", () => {
  it("laufende Runde wird nie überschrieben", () => {
    expect(() => assertCanStartPoll(running, T0 + H)).toThrow(POLL_ALREADY_RUNNING);
  });

  it("ohne Runde, abgelaufen, beendet oder verworfen darf neu gestartet werden", () => {
    expect(() => assertCanStartPoll(undefined, T0)).not.toThrow();
    expect(() => assertCanStartPoll(running, T0 + 48 * H)).not.toThrow();
    expect(() => assertCanStartPoll({ ...running, status: "closed" }, T0 + H)).not.toThrow();
    expect(() => assertCanStartPoll({ ...running, status: "none" }, T0 + H)).not.toThrow();
  });
});

describe("Stimmen im Alt-Format (Regression KOR-09)", () => {
  it("findet Stimmen, die noch als String stehen", () => {
    expect(legacyVoterIds({ ben: "s1", lena: ["s2"], max: [] })).toEqual(["ben"]);
    expect(legacyVoterIds(undefined)).toEqual([]);
    expect(legacyVoterIds("kaputt")).toEqual([]);
  });

  it("zweite Stimme ergänzt die alte statt sie zu ersetzen", () => {
    expect(toggledVotes(["s1"], "s2", true)).toEqual(["s1", "s2"]);
    expect(toggledVotes(["s1", "s2"], "s1", false)).toEqual(["s2"]);
    expect(toggledVotes(["s1"], "s1", true)).toEqual(["s1"]);
    expect(toggledVotes([], "s1", false)).toEqual([]);
  });
});

describe("startPollBlocker", () => {
  const gift = { personId: "anna", status: "open" as const, participantIds: ["ben", "lena", "max"] };

  it("alles erfüllt → null", () => {
    expect(startPollBlocker(gift, 2, "ben")).toBeNull();
  });

  it("nennt den ersten fehlenden Schritt", () => {
    expect(startPollBlocker(gift, 5, null)).toMatch(/wer du bist/);
    expect(startPollBlocker(gift, 5, "anna")).toMatch(/eigenes Geschenk/);
    expect(startPollBlocker({ ...gift, status: "confirmed" }, 5, "ben")).toMatch(/entschieden/);
    expect(startPollBlocker(gift, 5, "sophie")).toMatch(/mit/);
    expect(startPollBlocker(gift, 1, "ben")).toMatch(/2 Ideen/);
  });

  it("die beschenkte Person zählt nicht als Wahlberechtigte", () => {
    const g = { personId: "anna", status: "open" as const, participantIds: ["ben", "anna"] };
    expect(startPollBlocker(g, 3, "ben")).toMatch(/2 Teilnehmer/);
  });
});

describe("Sperren", () => {
  it("PollLockedError trägt Aktion und Text", () => {
    const err = new PollLockedError("addIdea");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("PollLockedError");
    expect(err.action).toBe("addIdea");
    expect(err.message).toBe(lockMessage("addIdea"));
  });

  it("nur reine paidBy-Änderungen sind ausgenommen", () => {
    expect(isPaidByOnlyPatch({ paidBy: "ben" })).toBe(true);
    expect(isPaidByOnlyPatch({ paidBy: undefined })).toBe(true);
    expect(isPaidByOnlyPatch({ paidBy: "ben", title: "x" })).toBe(false);
    expect(isPaidByOnlyPatch({})).toBe(false);
  });
});
