import { describe, expect, it } from "vitest";
import type { PollDoc } from "@shared/poll";
import {
  closeFields,
  extendedEndsAt,
  isPaidByOnlyPatch,
  lockMessage,
  newPollDoc,
  PollLockedError,
  startPollBlocker,
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
