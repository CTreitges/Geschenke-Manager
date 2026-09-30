import { describe, expect, it } from "vitest";
import { formatEuro, parsePrice } from "./money";

const NB = " "; // Intl de-DE setzt ein geschütztes Leerzeichen vor €

describe("parsePrice", () => {
  it("liest Komma, Punkt und ganze Zahlen", () => {
    expect(parsePrice("19,99")).toBe(19.99);
    expect(parsePrice("19.99")).toBe(19.99);
    expect(parsePrice("19")).toBe(19);
    expect(parsePrice("0")).toBe(0);
    expect(parsePrice("0,5")).toBe(0.5);
  });

  it("verträgt Tausenderpunkte, Euro-Zeichen und Leerzeichen", () => {
    expect(parsePrice(" 1.299,50 € ")).toBe(1299.5);
    expect(parsePrice("1.299")).toBe(1299);
    expect(parsePrice("12.345.678")).toBe(12345678);
    expect(parsePrice("1,299.50")).toBe(1299.5);
    expect(parsePrice("€ 45")).toBe(45);
    expect(parsePrice("45 EUR")).toBe(45);
    expect(parsePrice(`129${NB}€`)).toBe(129);
  });

  it("verträgt „ca.“ und „20,-“", () => {
    expect(parsePrice("ca. 20")).toBe(20);
    expect(parsePrice("20,-")).toBe(20);
    expect(parsePrice("20.--")).toBe(20);
  });

  it("rundet auf Cent und akzeptiert ein Trennzeichen am Ende", () => {
    expect(parsePrice("19,999")).toBe(20);
    expect(parsePrice("19,")).toBe(19);
    expect(parsePrice("0.500")).toBe(0.5);
  });

  it("negativ, leer oder Müll → undefined", () => {
    expect(parsePrice("-5")).toBeUndefined();
    expect(parsePrice("-19,99")).toBeUndefined();
    expect(parsePrice("")).toBeUndefined();
    expect(parsePrice("   ")).toBeUndefined();
    expect(parsePrice("abc")).toBeUndefined();
    expect(parsePrice("NaN")).toBeUndefined();
    expect(parsePrice("1,2,3")).toBeUndefined();
    expect(parsePrice("12a")).toBeUndefined();
    expect(parsePrice("1e5")).toBeUndefined();
    expect(parsePrice(undefined)).toBeUndefined();
    expect(parsePrice(null)).toBeUndefined();
  });
});

describe("formatEuro", () => {
  it("ganze Beträge ohne „,00“", () => {
    expect(formatEuro(129)).toBe(`129${NB}€`);
    expect(formatEuro(0)).toBe(`0${NB}€`);
    expect(formatEuro(1299)).toBe(`1.299${NB}€`);
  });

  it("sonst immer zwei Nachkommastellen", () => {
    expect(formatEuro(19.99)).toBe(`19,99${NB}€`);
    expect(formatEuro(19.5)).toBe(`19,50${NB}€`);
    expect(formatEuro(32.25)).toBe(`32,25${NB}€`);
    expect(formatEuro(1299.5)).toBe(`1.299,50${NB}€`);
  });

  it("rundet auf Cent, bevor entschieden wird", () => {
    expect(formatEuro(19.999)).toBe(`20${NB}€`);
    expect(formatEuro(-0.001)).toBe(`0${NB}€`);
  });

  it("ungültig → leerer Text", () => {
    expect(formatEuro(Number.NaN)).toBe("");
    expect(formatEuro(Number.POSITIVE_INFINITY)).toBe("");
  });

  it("Rundlauf parsePrice → formatEuro", () => {
    expect(formatEuro(parsePrice(" 1.299,50 € ")!)).toBe(`1.299,50${NB}€`);
  });
});
