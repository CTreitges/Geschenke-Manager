import { describe, expect, it } from "vitest";
import { FRESH_WISH_DAYS, isFreshOwnWish } from "./wishlist";

const DAY = 86_400_000;
const NOW = Date.parse("2026-09-30T12:00:00Z");

describe("isFreshOwnWish", () => {
  it("frischer eigener Wunsch zählt (addedBy leer oder die Person selbst)", () => {
    expect(isFreshOwnWish({ createdAt: NOW - 10 * DAY }, "anna", NOW)).toBe(true);
    expect(isFreshOwnWish({ createdAt: NOW - 10 * DAY, addedBy: "anna" }, "anna", NOW)).toBe(true);
    expect(isFreshOwnWish({ createdAt: NOW - 10 * DAY, addedBy: null }, "anna", NOW)).toBe(true);
    expect(isFreshOwnWish({ createdAt: NOW - 10 * DAY, addedBy: "" }, "anna", NOW)).toBe(true);
  });

  it("von anderen notierte Wünsche zählen nicht", () => {
    expect(isFreshOwnWish({ createdAt: NOW - DAY, addedBy: "ben" }, "anna", NOW)).toBe(false);
  });

  it("erfüllte Wünsche zählen nicht", () => {
    expect(isFreshOwnWish({ createdAt: NOW - DAY, fulfilledAt: NOW - 1000 }, "anna", NOW)).toBe(false);
    expect(isFreshOwnWish({ createdAt: NOW - DAY, fulfilledAt: null }, "anna", NOW)).toBe(true);
  });

  it("Grenze 120 Tage: jünger zählt, genau 120 Tage nicht mehr", () => {
    expect(FRESH_WISH_DAYS).toBe(120);
    expect(isFreshOwnWish({ createdAt: NOW - 120 * DAY + 1 }, "anna", NOW)).toBe(true);
    expect(isFreshOwnWish({ createdAt: NOW - 120 * DAY }, "anna", NOW)).toBe(false);
    expect(isFreshOwnWish({ createdAt: NOW - 400 * DAY }, "anna", NOW)).toBe(false);
  });

  it("updatedAt („Noch aktuell ✓“) macht einen alten Wunsch wieder frisch", () => {
    expect(isFreshOwnWish({ createdAt: NOW - 400 * DAY, updatedAt: NOW - 5 * DAY }, "anna", NOW)).toBe(true);
    expect(isFreshOwnWish({ createdAt: NOW - 400 * DAY, updatedAt: null }, "anna", NOW)).toBe(false);
  });

  it("ungültiger Zeitstempel zählt nicht", () => {
    expect(isFreshOwnWish({ createdAt: Number.NaN }, "anna", NOW)).toBe(false);
  });
});
