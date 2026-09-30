import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daysUntilBirthday, isInStackWindow, sortStack } from "./birthdays";
import type { Gift, Person } from "./types";

// Fester Referenztag (lokale Zeit): Sonntag, 20. Dezember 2026, 9 Uhr.
const REF = new Date(2026, 11, 20, 9, 0);

const person = (id: string, birthday: string): Person => ({
  id,
  name: id,
  birthday,
  color: "#000000",
  createdAt: 0,
});

const gift = (id: string, personId: string, extra: Partial<Gift> = {}): Gift => ({
  id,
  personId,
  year: 2026,
  status: "open",
  budgetPerPerson: 20,
  manuallyAdded: false,
  stackOrder: 0,
  enteredStackAt: 0,
  participantIds: [],
  ...extra,
});

describe("daysUntilBirthday", () => {
  it("zählt Tage bis zum Geburtstag im selben Jahr (Geburtsjahr egal)", () => {
    expect(daysUntilBirthday(person("a", "12-25"), REF)).toBe(5);
    expect(daysUntilBirthday(person("a", "1990-12-25"), REF)).toBe(5);
  });

  it("liefert 0 am Geburtstag selbst, auch spät am Abend", () => {
    expect(daysUntilBirthday(person("a", "12-20"), REF)).toBe(0);
    expect(daysUntilBirthday(person("a", "12-20"), new Date(2026, 11, 20, 23, 59))).toBe(0);
  });

  it("springt über den Jahreswechsel", () => {
    expect(daysUntilBirthday(person("a", "01-05"), REF)).toBe(16);
    // Gestern gewesen → erst wieder in knapp einem Jahr.
    expect(daysUntilBirthday(person("a", "12-19"), REF)).toBe(364);
  });

  it("rechnet über die Sommerzeit-Umstellung ganze Tage", () => {
    expect(daysUntilBirthday(person("a", "04-01"), new Date(2026, 2, 25))).toBe(7);
  });
});

describe("isInStackWindow", () => {
  it("nimmt Geburtstage bis einschließlich 30 Tage auf, auch über den Jahreswechsel", () => {
    expect(isInStackWindow(person("a", "01-19"), REF)).toBe(true); // 30 Tage
    expect(isInStackWindow(person("a", "01-20"), REF)).toBe(false); // 31 Tage
    expect(isInStackWindow(person("a", "12-20"), REF)).toBe(true); // heute
    expect(isInStackWindow(person("a", "12-19"), REF)).toBe(false); // gestern
  });
});

describe("sortStack", () => {
  // sortStack rechnet mit dem aktuellen Datum → Systemzeit festsetzen.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(REF);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const persons = [
    person("neujahr", "01-05"), // 16 Tage
    person("weihnachten", "12-25"), // 5 Tage
    person("silvester", "12-31"), // 11 Tage
    person("zwilling", "12-31"), // 11 Tage
  ];

  it("sortiert nach nächstem Termin, auch über den Jahreswechsel", () => {
    const sorted = sortStack(
      [gift("g1", "neujahr"), gift("g2", "weihnachten"), gift("g3", "silvester")],
      persons,
    );
    expect(sorted.map((g) => g.id)).toEqual(["g2", "g3", "g1"]);
  });

  it("filtert erhaltene Geschenke heraus und behält bestätigte", () => {
    const sorted = sortStack(
      [
        gift("g1", "neujahr", { status: "confirmed" }),
        gift("g2", "weihnachten", { status: "received" }),
      ],
      persons,
    );
    expect(sorted.map((g) => g.id)).toEqual(["g1"]);
  });

  it("nutzt bei gleichem Termin die Reihenfolge des Eintritts in den Stack", () => {
    const sorted = sortStack(
      [
        gift("spaet", "zwilling", { enteredStackAt: 200 }),
        gift("frueh", "silvester", { enteredStackAt: 100 }),
      ],
      persons,
    );
    expect(sorted.map((g) => g.id)).toEqual(["frueh", "spaet"]);
  });

  it("bevorzugt ein eigenes Datum (customDate) vor dem Geburtstag", () => {
    const sorted = sortStack(
      [gift("g1", "weihnachten"), gift("g2", "neujahr", { customDate: "2026-12-21" })],
      persons,
    );
    expect(sorted.map((g) => g.id)).toEqual(["g2", "g1"]);
  });

  it("gibt die Eingabe nicht verändert zurück", () => {
    const input = [gift("g1", "neujahr"), gift("g2", "weihnachten")];
    sortStack(input, persons);
    expect(input.map((g) => g.id)).toEqual(["g1", "g2"]);
  });
});
