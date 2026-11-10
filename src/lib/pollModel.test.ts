import { describe, expect, it } from "vitest";
import type { PollDoc } from "@shared/poll";
import { pollModel } from "./pollModel";
import type { Gift } from "./types";

const HOUR = 3_600_000;
const NOW = Date.parse("2026-09-30T12:00:00+02:00");

const gift = (extra: Partial<Gift> = {}): Gift => ({
  id: "g1",
  personId: "anna",
  year: 2026,
  status: "open",
  budgetPerPerson: 20,
  manuallyAdded: false,
  stackOrder: 0,
  enteredStackAt: 0,
  participantIds: ["ben", "lena", "max"],
  ...extra,
});

const ideas = [
  { id: "s1", createdAt: 1 },
  { id: "s2", createdAt: 2 },
];

const running: PollDoc = {
  status: "active",
  startedAt: NOW - HOUR,
  endsAt: NOW + HOUR,
  votes: { ben: ["s1", "weg"], lena: ["s2"], sophie: ["s1"], anna: ["s1"] },
};

describe("pollModel", () => {
  it("ohne Poll: Phase none, keine Sperren, kein Ergebnis", () => {
    const m = pollModel(gift(), undefined, ideas, "ben", NOW);
    expect(m.phase).toBe("none");
    expect(m.result).toBeNull();
    expect(m.locks.addIdea.locked).toBe(false);
    expect(m.voters).toEqual({ voted: 0, total: 3, missing: ["ben", "lena", "max"] });
  });

  it("laufend: zählt nur Wahlberechtigte und existierende Ideen (B18/B20)", () => {
    const m = pollModel(gift(), running, ideas, "ben", NOW);
    expect(m.phase).toBe("running");
    expect(m.endsAt).toBe(NOW + HOUR);
    expect(m.counts).toEqual({ s1: ["ben"], s2: ["lena"] });
    expect(m.voters).toEqual({ voted: 2, total: 3, missing: ["max"] });
    expect(m.myVotes).toEqual(["s1"]);
    expect(m.canVote).toBe(true);
    expect(m.result).toBeNull();
    expect(m.locks.addIdea.locked).toBe(true);
  });

  it("abgelaufen: Ergebnis mit Gleichstand, Sperren sind aufgehoben", () => {
    const m = pollModel(gift(), running, ideas, "ben", NOW + 2 * HOUR);
    expect(m.phase).toBe("expired");
    expect(m.canVote).toBe(false);
    expect(m.result).toEqual({ kind: "tie", ids: ["s1", "s2"], votes: 1 });
    expect(m.locks.addIdea.locked).toBe(false);
  });

  it("Nicht-Teilnehmer und beschenkte Person dürfen nicht abstimmen (B7)", () => {
    const sophie = pollModel(gift(), running, ideas, "sophie", NOW);
    expect(sophie.isEligible).toBe(false);
    expect(sophie.canVote).toBe(false);
    const anna = pollModel(gift({ participantIds: ["ben", "anna"] }), running, ideas, "anna", NOW);
    expect(anna.isRecipient).toBe(true);
    expect(anna.canVote).toBe(false);
  });

  it("entschiedenes Geschenk: keine Stimmen mehr trotz aktivem Poll (Zombie-Fix)", () => {
    const m = pollModel(gift({ status: "confirmed" }), running, ideas, "ben", NOW);
    expect(m.canVote).toBe(false);
    expect(m.locks.addIdea.locked).toBe(false);
  });
});
