import { describe, expect, it } from "vitest";
import { dedupPlan, personDeletion, withLiveParticipants } from "./cascade";
import type { GiftStatus } from "./types";

type GiftExtra = Partial<{
  year: number;
  status: GiftStatus;
  participantIds: string[];
  selectedSuggestionIds: string[];
  enteredStackAt: number;
  manuallyAdded: boolean;
  occasion: string;
  skippedAt: number;
}>;

const gift = (id: string, personId: string, extra: GiftExtra = {}) => ({
  id,
  personId,
  year: 2026,
  status: "open" as GiftStatus,
  participantIds: [] as string[],
  enteredStackAt: 0,
  manuallyAdded: false,
  ...extra,
});

describe("personDeletion", () => {
  const data = {
    gifts: [
      gift("anna_2026", "anna", { participantIds: ["ben", "anna"] }),
      gift("anna_2025", "anna", { status: "received" }),
      gift("ben_2026", "ben", { participantIds: ["anna", "max"] }),
      gift("max_2026", "max", { participantIds: ["ben"] }),
    ],
    persons: [
      { id: "anna", defaultParticipantIds: ["ben"] },
      { id: "ben", defaultParticipantIds: ["anna", "max"] },
      { id: "max" },
    ],
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
    expect(personDeletion("anna", data)).toMatchObject({
      gifts: ["anna_2026", "anna_2025"],
      suggestions: ["s1", "s2"],
      polls: ["anna_2026", "anna_2025"],
      wishlist: ["w1"],
    });
  });

  it("trägt die Person aus fremden Geschenken und Standard-Teilnehmern aus (Regression KOR-05)", () => {
    const plan = personDeletion("anna", data);
    expect(plan.participantOf).toEqual(["ben_2026"]);
    expect(plan.defaultParticipantOf).toEqual(["ben"]);
    expect(personDeletion("max", data)).toMatchObject({ participantOf: ["ben_2026"], defaultParticipantOf: ["ben"] });
  });

  it("lässt andere Personen unberührt und kommt ohne Daten aus", () => {
    expect(personDeletion("sophie", data)).toEqual({
      gifts: [],
      suggestions: [],
      polls: [],
      wishlist: [],
      participantOf: [],
      defaultParticipantOf: [],
    });
    expect(personDeletion("anna", { gifts: [], suggestions: [], wishlist: [] }).defaultParticipantOf).toEqual([]);
  });
});

describe("withLiveParticipants", () => {
  it("wirft gelöschte Personen raus, lässt sonst dasselbe Objekt", () => {
    const g = gift("a", "anna", { participantIds: ["ben", "geist", "max"] });
    expect(withLiveParticipants(g, new Set(["ben", "max"])).participantIds).toEqual(["ben", "max"]);
    const clean = gift("b", "anna", { participantIds: ["ben"] });
    expect(withLiveParticipants(clean, new Set(["ben"]))).toBe(clean);
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

  it("nur Auto-Geschenke mit gleichem Anlass; nie manuelle, ausgesetzte oder mit laufender Abstimmung (Regression KOR-11)", () => {
    const wedding = [gift("auto", "anna"), gift("hochzeit", "anna", { manuallyAdded: true, occasion: "Hochzeit" })];
    expect(dedupPlan(wedding, [{ id: "s", giftId: "hochzeit" }])).toEqual({ gifts: [], moves: [] });
    const manualTwin = [gift("auto", "anna"), gift("manuell", "anna", { manuallyAdded: true })];
    expect(dedupPlan(manualTwin, []).gifts).toEqual([]);
    const otherOccasion = [gift("a1", "anna", { occasion: "Reise" }), gift("a2", "anna")];
    expect(dedupPlan(otherOccasion, []).gifts).toEqual([]);
    const skipped = [gift("a1", "anna", { skippedAt: 5 }), gift("a2", "anna")];
    expect(dedupPlan(skipped, []).gifts).toEqual([]);
    const running = [gift("a1", "anna", { participantIds: ["x", "y"] }), gift("a2", "anna")];
    expect(dedupPlan(running, [{ id: "s", giftId: "a2" }], new Set(["a1"]))).toEqual({ gifts: [], moves: [] });
    expect(dedupPlan(running, [{ id: "s", giftId: "a2" }], new Set(["a2"]))).toEqual({ gifts: [], moves: [] });
    // „Geburtstag“ explizit und ohne Anlass sind derselbe Anlass.
    const same = [gift("a1", "anna", { occasion: "Geburtstag", enteredStackAt: 1 }), gift("a2", "anna", { enteredStackAt: 2 })];
    expect(dedupPlan(same, []).gifts).toEqual(["a2"]);
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
