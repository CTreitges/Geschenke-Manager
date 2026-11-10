import { describe, expect, it } from "vitest";
import {
  assertNotRecipient,
  isRecipient,
  mySurpriseGiftIds,
  nextSurprise,
  RECIPIENT_BLOCKED,
  surpriseBanner,
  surpriseOccasion,
  surprisePhase,
} from "./spoiler";
import type { Gift, GiftStatus, Person } from "./types";

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

describe("assertNotRecipient", () => {
  it("wirft nur für die beschenkte Person", () => {
    expect(() => assertNotRecipient(gift("g1", "anna"), "anna")).toThrow(RECIPIENT_BLOCKED);
    expect(() => assertNotRecipient(gift("g1", "anna"), "ben")).not.toThrow();
    expect(() => assertNotRecipient(undefined, "anna")).not.toThrow();
  });
});

describe("nextSurprise", () => {
  const ref = new Date(2026, 8, 30); // 30. Sep 2026
  const anna: Person = { id: "anna", name: "Anna", birthday: "10-08", color: "#DB2777", createdAt: 0 };
  const full = (id: string, extra: Partial<Gift> = {}): Gift => ({
    id,
    personId: "anna",
    year: 2026,
    status: "open",
    budgetPerPerson: 20,
    manuallyAdded: false,
    stackOrder: 0,
    enteredStackAt: 0,
    participantIds: [],
    ...extra,
  });

  it("liefert die früheste laufende Überraschung mit Datum", () => {
    const later = full("wedding", { customDate: "2026-11-20", occasion: "Hochzeit" });
    const birthday = full("anna_2026");
    const hit = nextSurprise([later, birthday], [anna], "anna", ref);
    expect(hit?.gift.id).toBe("anna_2026");
    expect(hit?.date?.getDate()).toBe(8);
    expect(hit?.date?.getMonth()).toBe(9);
  });

  it("null ohne Identität, für andere und nach der Übergabe", () => {
    expect(nextSurprise([full("g")], [anna], null, ref)).toBeNull();
    expect(nextSurprise([full("g")], [anna], "ben", ref)).toBeNull();
    expect(nextSurprise([full("g", { status: "received" })], [anna], "anna", ref)).toBeNull();
  });
});

describe("surpriseOccasion / surpriseBanner", () => {
  it("Geburtstag als „deinen Geburtstag“, anderes in Anführungszeichen", () => {
    expect(surpriseOccasion(undefined)).toBe("deinen Geburtstag");
    expect(surpriseOccasion("Geburtstag")).toBe("deinen Geburtstag");
    expect(surpriseOccasion(" Hochzeit ")).toBe("„Hochzeit“");
  });

  it("Banner mit und ohne Datum", () => {
    expect(surpriseBanner(undefined, new Date(2026, 9, 8))).toBe(
      "🤫 Für deinen Geburtstag am 8. Okt wird schon geplant – ergänze gern Wünsche.",
    );
    expect(surpriseBanner("Reise", null)).toBe("🤫 Für „Reise“ wird schon geplant – ergänze gern Wünsche.");
  });
});
