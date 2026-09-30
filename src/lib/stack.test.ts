import { describe, expect, it } from "vitest";
import type { PollDoc } from "@shared/poll";
import { giftMenuState, isSkipped } from "./stack";

const NOW = Date.parse("2026-09-30T12:00:00+02:00");
const HOUR = 3_600_000;

const gift = (extra: Partial<{ status: "open" | "confirmed" | "received"; manuallyAdded: boolean; skippedAt: number }> = {}) => ({
  status: "open" as const,
  manuallyAdded: false,
  ...extra,
});

const running: PollDoc = { status: "active", startedAt: NOW - HOUR, endsAt: NOW + HOUR, votes: {} };
const expired: PollDoc = { status: "active", startedAt: NOW - 3 * HOUR, endsAt: NOW - HOUR, votes: {} };

describe("isSkipped", () => {
  it("erkennt ausgesetzte Geschenke am Zeitstempel", () => {
    expect(isSkipped({ skippedAt: 0 })).toBe(true);
    expect(isSkipped({})).toBe(false);
  });
});

describe("giftMenuState", () => {
  it("bietet bei automatischen Geschenken Aussetzen statt Löschen an", () => {
    expect(giftMenuState(gift(), null, NOW)).toEqual({ skip: "available", resume: false, remove: false });
  });

  it("erlaubt Löschen nur bei manuell angelegten und erhaltenen Geschenken", () => {
    expect(giftMenuState(gift({ manuallyAdded: true }), null, NOW).remove).toBe(true);
    expect(giftMenuState(gift({ status: "confirmed" }), null, NOW).remove).toBe(false);
    expect(giftMenuState(gift({ status: "received" }), null, NOW)).toEqual({ skip: "hidden", resume: false, remove: true });
  });

  it("sperrt Aussetzen, solange die Abstimmung läuft – eine abgelaufene sperrt nicht", () => {
    expect(giftMenuState(gift(), running, NOW).skip).toBe("locked");
    expect(giftMenuState(gift(), expired, NOW).skip).toBe("available");
    expect(giftMenuState(gift({ status: "confirmed" }), null, NOW).skip).toBe("available");
  });

  it("zeigt bei ausgesetzten Geschenken nur „Wieder aufnehmen“", () => {
    expect(giftMenuState(gift({ skippedAt: NOW }), running, NOW)).toEqual({ skip: "hidden", resume: true, remove: false });
    expect(giftMenuState(gift({ skippedAt: NOW, manuallyAdded: true }), null, NOW).remove).toBe(true);
  });
});
