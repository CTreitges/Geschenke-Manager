import { describe, expect, it } from "vitest";
import { contrastRatio, parseHex, readableTextOn, relativeLuminance, TEXT_ON_DARK, TEXT_ON_LIGHT } from "./colors";

describe("parseHex", () => {
  it("liest 6- und 3-stellige Hex-Werte, mit und ohne #", () => {
    expect(parseHex("#7C3AED")).toEqual([124, 58, 237]);
    expect(parseHex("fff")).toEqual([255, 255, 255]);
    expect(parseHex(" #0a0 ")).toEqual([0, 170, 0]);
  });

  it("liefert null bei ungültiger Eingabe", () => {
    expect(parseHex("")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
    expect(parseHex("rot")).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("entspricht den WCAG-Referenzwerten", () => {
    expect(relativeLuminance([0, 0, 0])).toBe(0);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 10);
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrastRatio([255, 255, 255], [255, 255, 255])).toBe(1);
    // Weiß auf #4F46E5 (Start von grad-primary) laut dim-design 6,29:1
    expect(contrastRatio([255, 255, 255], parseHex("#4F46E5")!)).toBeCloseTo(6.29, 2);
  });
});

describe("readableTextOn", () => {
  it("wählt Weiß auf dunklen Avatar-Farben", () => {
    expect(readableTextOn("#4F46E5")).toBe(TEXT_ON_DARK);
    expect(readableTextOn("#7C3AED")).toBe(TEXT_ON_DARK);
    expect(readableTextOn("#DC2626")).toBe(TEXT_ON_DARK);
  });

  it("wählt dunklen Text auf hellen Avatar-Farben (bisher < 3:1 mit Weiß)", () => {
    for (const hex of ["#F97316", "#CA8A04", "#65A30D"]) {
      expect(readableTextOn(hex), hex).toBe(TEXT_ON_LIGHT);
      expect(contrastRatio(parseHex(hex)!, parseHex(TEXT_ON_LIGHT)!)).toBeGreaterThan(4.5);
    }
  });

  it("fällt bei ungültiger Farbe auf Weiß zurück", () => {
    expect(readableTextOn("")).toBe(TEXT_ON_DARK);
    expect(readableTextOn("hsl(0 0% 0%)")).toBe(TEXT_ON_DARK);
  });
});
