import { describe, expect, it } from "vitest";
import { isRecipient, mySurpriseGiftIds, surprisePhase } from "./spoiler";
import type { GiftStatus } from "./types";

const gift = (id: string, personId: string, status: GiftStatus = "open") => ({ id, personId, status });

describe("isRecipient", () => {
  it("true nur für die beschenkte Person", () => {
    expect(isRecipient(gift("g1", "anna"), "anna")).toBe(true);
    expect(isRecipient(gift("g1", "anna"), "ben")).toBe(false);
  });

  it("ohne Identität oder ohne Geschenk nie", () => {
    expect(isRecipient(gift("g1", "anna"), null)).toBe(false);
    expect(isRecipient(gift("g1", "anna"), undefined)).toBe(false);
    expect(isRecipient(gift("g1", "anna"), "")).toBe(false);
    expect(isRecipient(null, "anna")).toBe(false);
    expect(isRecipient(undefined, "anna")).toBe(false);
  });
});

describe("surprisePhase", () => {
  it("open und confirmed → planning (bestätigt verrät schon etwas)", () => {
    expect(surprisePhase(gift("g1", "anna", "open"), "anna")).toBe("planning");
    expect(surprisePhase(gift("g1", "anna", "confirmed"), "anna")).toBe("planning");
  });

  it("received → handedOver", () => {
    expect(surprisePhase(gift("g1", "anna", "received"), "anna")).toBe("handedOver");
  });

  it("none für andere, ohne Identität und ohne Geschenk", () => {
    expect(surprisePhase(gift("g1", "anna"), "ben")).toBe("none");
    expect(surprisePhase(gift("g1", "anna"), null)).toBe("none");
    expect(surprisePhase(gift("g1", "anna", "received"), undefined)).toBe("none");
    expect(surprisePhase(null, "anna")).toBe("none");
  });
});

describe("mySurpriseGiftIds", () => {
  const gifts = [
    gift("g1", "anna", "open"),
    gift("g2", "anna", "confirmed"),
    gift("g3", "anna", "received"),
    gift("g4", "ben", "open"),
  ];

  it("enthält nur meine laufenden Überraschungen", () => {
    expect([...mySurpriseGiftIds(gifts, "anna")].sort()).toEqual(["g1", "g2"]);
    expect([...mySurpriseGiftIds(gifts, "ben")]).toEqual(["g4"]);
  });

  it("leer ohne Identität oder ohne Geschenke", () => {
    expect(mySurpriseGiftIds(gifts, null).size).toBe(0);
    expect(mySurpriseGiftIds([], "anna").size).toBe(0);
  });
});
