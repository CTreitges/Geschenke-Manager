import { describe, expect, it } from "vitest";
import { dedupPlan, personDeletion } from "./cascade";
import type { GiftStatus } from "./types";

const gift = (id: string, personId: string, extra: Partial<{ year: number; status: GiftStatus; participantIds: string[]; selectedSuggestionIds: string[]; enteredStackAt: number }> = {}) => ({
  id,
  personId,
  year: 2026,
  status: "open" as GiftStatus,
  participantIds: [] as string[],
  enteredStackAt: 0,
  ...extra,
});

describe("personDeletion", () => {
  const data = {
    gifts: [gift("anna_2026", "anna"), gift("anna_2025", "anna", { status: "received" }), gift("ben_2026", "ben")],
    suggestions: [
      { id: "s1", giftId: "anna_2026" },
      { id: "s2", giftId: "anna_2025" },
      { id: "s3", giftId: "ben_2026" },
    ],
    wishlist: [
      { id: "w1", personId: "anna" },
      { id: "w2", personId: "ben" },
    ],
  };

  it("nimmt Geschenke samt Ideen, Polls und Wünschen der Person mit", () => {
    expect(personDeletion("anna", data)).toEqual({
      gifts: ["anna_2026", "anna_2025"],
      suggestions: ["s1", "s2"],
      polls: ["anna_2026", "anna_2025"],
      wishlist: ["w1"],
    });
  });

  it("lässt andere Personen unberührt und kommt ohne Daten aus", () => {
    expect(personDeletion("max", data)).toEqual({ gifts: [], suggestions: [], polls: [], wishlist: [] });
  });
});

describe("dedupPlan", () => {
  it("behält das reichste Geschenk und zieht die Ideen der Doppel um", () => {
    const gifts = [
      gift("a1", "anna", { participantIds: ["ben"], enteredStackAt: 1 }),
      gift("a2", "anna", { participantIds: ["ben", "max"], enteredStackAt: 2 }),
      gift("b1", "ben"),
    ];
    const suggestions = [
      { id: "s1", giftId: "a1" },
      { id: "s2", giftId: "a2" },
      { id: "s3", giftId: "b1" },
    ];
    expect(dedupPlan(gifts, suggestions)).toEqual({ gifts: ["a1"], moves: [{ id: "s1", giftId: "a2" }] });
  });

  it("bei Gleichstand bleibt das ältere; Auswahl zählt halb", () => {
    const tie = [gift("new", "anna", { enteredStackAt: 5 }), gift("old", "anna", { enteredStackAt: 1 })];
    expect(dedupPlan(tie, []).gifts).toEqual(["new"]);
    const selected = [
      gift("sel", "anna", { selectedSuggestionIds: ["x", "y", "z"], enteredStackAt: 5 }),
      gift("part", "anna", { participantIds: ["a"], enteredStackAt: 1 }),
    ];
    expect(dedupPlan(selected, []).gifts).toEqual(["part"]);
  });

  it("ignoriert andere Jahre und nicht offene Geschenke", () => {
    const gifts = [
      gift("a1", "anna"),
      gift("a2", "anna", { year: 2025 }),
      gift("a3", "anna", { status: "confirmed" }),
    ];
    expect(dedupPlan(gifts, [{ id: "s", giftId: "a3" }])).toEqual({ gifts: [], moves: [] });
  });
});
