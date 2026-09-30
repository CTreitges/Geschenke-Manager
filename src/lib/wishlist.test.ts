import { describe, expect, it } from "vitest";
import { STALE_WISH_DAYS, isStale, sortWishes } from "./wishlist";

const DAY = 86_400_000;
const NOW = Date.parse("2026-09-30T12:00:00Z");

describe("sortWishes", () => {
  it("Herzenswünsche zuerst, innerhalb der Gruppen die neuesten zuerst", () => {
    const wishes = [
      { id: "alt", createdAt: 1 },
      { id: "fav-alt", createdAt: 2, favorite: true },
      { id: "neu", createdAt: 5 },
      { id: "fav-neu", createdAt: 4, favorite: true },
      { id: "kein-fav", createdAt: 3, favorite: false },
    ];
    expect(sortWishes(wishes).map((w) => w.id)).toEqual(["fav-neu", "fav-alt", "neu", "kein-fav", "alt"]);
  });

  it("gleicher Zeitpunkt → ID (deterministisch) und keine Mutation der Eingabe", () => {
    const wishes = [
      { id: "b", createdAt: 1 },
      { id: "a", createdAt: 1 },
    ];
    expect(sortWishes(wishes).map((w) => w.id)).toEqual(["a", "b"]);
    expect(wishes.map((w) => w.id)).toEqual(["b", "a"]);
  });

  it("leere Liste", () => {
    expect(sortWishes([])).toEqual([]);
  });
});

describe("isStale", () => {
  it("veraltet erst nach mehr als 365 Tagen", () => {
    expect(STALE_WISH_DAYS).toBe(365);
    expect(isStale({ createdAt: NOW - 365 * DAY }, NOW)).toBe(false);
    expect(isStale({ createdAt: NOW - 365 * DAY - 1 }, NOW)).toBe(true);
    expect(isStale({ createdAt: NOW - 10 * DAY }, NOW)).toBe(false);
  });

  it("updatedAt („Noch aktuell ✓“) setzt die Uhr zurück", () => {
    expect(isStale({ createdAt: NOW - 800 * DAY, updatedAt: NOW - DAY }, NOW)).toBe(false);
    expect(isStale({ createdAt: NOW - 800 * DAY, updatedAt: NOW - 400 * DAY }, NOW)).toBe(true);
  });
});
