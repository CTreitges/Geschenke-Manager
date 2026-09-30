import { describe, expect, it } from "vitest";
import { birthdayYearFor, daysUntil, parseBirthday } from "./dates";

// Fester Referenztag (lokale Zeit): 20. Dezember 2026.
const REF = new Date(2026, 11, 20, 9, 0);

describe("parseBirthday", () => {
  it("liest MM-DD und YYYY-MM-DD (Jahr wird ignoriert)", () => {
    expect(parseBirthday("03-07")).toEqual({ month: 3, day: 7 });
    expect(parseBirthday("1985-03-07")).toEqual({ month: 3, day: 7 });
  });

  it("gibt null bei ungültigen Werten zurück", () => {
    expect(parseBirthday("")).toBeNull();
    expect(parseBirthday("13-01")).toBeNull();
    expect(parseBirthday("00-10")).toBeNull();
    expect(parseBirthday("05-32")).toBeNull();
    expect(parseBirthday("1-2-3-4")).toBeNull();
  });
});

describe("daysUntil", () => {
  it("zählt Tage bis zum Geburtstag im selben Jahr", () => {
    expect(daysUntil("12-25", REF)).toBe(5);
    expect(daysUntil("1990-12-25", REF)).toBe(5);
  });

  it("liefert 0 am Geburtstag selbst, unabhängig von der Uhrzeit", () => {
    expect(daysUntil("12-20", REF)).toBe(0);
    expect(daysUntil("12-20", new Date(2026, 11, 20, 23, 59))).toBe(0);
  });

  it("springt über den Jahreswechsel", () => {
    expect(daysUntil("01-05", REF)).toBe(16);
    expect(daysUntil("12-19", REF)).toBe(364);
  });

  it("gibt null bei ungültigem Geburtstag zurück", () => {
    expect(daysUntil("kein-datum", REF)).toBeNull();
  });
});

describe("birthdayYearFor", () => {
  it("liefert das Jahr des nächsten Geburtstags", () => {
    expect(birthdayYearFor("12-25", REF)).toBe(2026);
    expect(birthdayYearFor("01-05", REF)).toBe(2027);
    expect(birthdayYearFor("99-99", REF)).toBeNull();
  });
});
