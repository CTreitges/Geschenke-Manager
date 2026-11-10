import { describe, expect, it } from "vitest";
import {
  STALE_WISH_DAYS,
  addedByLabel,
  adoptedSuggestionId,
  fulfilledWishIds,
  giftLabel,
  groupWishes,
  isStale,
  sortWishes,
  wishBadges,
  wishStripSummary,
} from "./wishlist";

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

describe("groupWishes", () => {
  const w = (
    id: string,
    extra: Partial<{ createdAt: number; favorite: boolean; updatedAt: number; fulfilledAt: number }> = {},
  ) => ({ id, personId: "anna", createdAt: NOW - DAY, ...extra });

  it("teilt in Herzenswünsche, weitere, veraltete und bekommene", () => {
    const g = groupWishes(
      [
        w("neu"),
        w("fav", { favorite: true }),
        w("alt", { createdAt: NOW - 400 * DAY }),
        w("alt-fav", { createdAt: NOW - 400 * DAY, favorite: true }),
        w("alt-bestaetigt", { createdAt: NOW - 400 * DAY, updatedAt: NOW - DAY }),
        w("bekommen-2025", { fulfilledAt: NOW - 300 * DAY }),
        w("bekommen-2026", { fulfilledAt: NOW - 10 * DAY, favorite: true }),
      ],
      NOW,
    );
    expect(g.favorites.map((x) => x.id)).toEqual(["fav"]);
    expect(g.rest.map((x) => x.id)).toEqual(["neu", "alt-bestaetigt"]);
    // Veraltet schlägt Herzenswunsch; bekommen schlägt alles.
    expect(g.stale.map((x) => x.id)).toEqual(["alt-fav", "alt"]);
    expect(g.fulfilled.map((x) => x.id)).toEqual(["bekommen-2026", "bekommen-2025"]);
  });

  it("leere Liste → vier leere Gruppen", () => {
    expect(groupWishes([], NOW)).toEqual({ favorites: [], rest: [], stale: [], fulfilled: [] });
  });
});

describe("adoptedSuggestionId / giftLabel", () => {
  it("ID ist deterministisch pro Geschenk und Wunsch", () => {
    expect(adoptedSuggestionId("anna_2026", "w1")).toBe("wish_anna_2026_w1");
    expect(adoptedSuggestionId("anna_2026", "w2")).not.toBe(adoptedSuggestionId("anna_2026", "w1"));
  });

  it("Anlass fehlt oder ist leer → Geburtstag", () => {
    expect(giftLabel({ year: 2026 })).toBe("Geburtstag 2026");
    expect(giftLabel({ year: 2026, occasion: "  " })).toBe("Geburtstag 2026");
    expect(giftLabel({ year: 2027, occasion: "Hochzeit" })).toBe("Hochzeit 2027");
  });
});

describe("fulfilledWishIds", () => {
  const suggestions = [
    { id: "s1", giftId: "g1", fromWishItemId: "w1" },
    { id: "s2", giftId: "g1", fromWishItemId: "w2" },
    { id: "s3", giftId: "g1" },
    { id: "s4", giftId: "g2", fromWishItemId: "w3" },
    { id: "s5", giftId: "g1", fromWishItemId: "w-geloescht" },
    { id: "s6", giftId: "g1", fromWishItemId: "w1" },
  ];
  const existing = new Set(["w1", "w2", "w3"]);

  it("nur ausgewählte Ideen dieses Geschenks mit noch existierendem Wunsch, ohne Doppelte", () => {
    const gift = { id: "g1", selectedSuggestionIds: ["s1", "s3", "s5", "s6", "s4"] };
    expect(fulfilledWishIds(gift, suggestions, existing)).toEqual(["w1"]);
  });

  it("ohne Auswahl → nichts", () => {
    expect(fulfilledWishIds({ id: "g1" }, suggestions, existing)).toEqual([]);
  });
});

describe("wishBadges", () => {
  const gifts = [
    { id: "g-bday", year: 2026, status: "open" },
    { id: "g-xmas", year: 2026, status: "confirmed", occasion: "Weihnachten" },
    { id: "g-old", year: 2025, status: "received" },
  ];
  const suggestions = [
    { id: "s1", giftId: "g-bday", fromWishItemId: "w1" },
    { id: "s2", giftId: "g-xmas", fromWishItemId: "w1" },
    { id: "s3", giftId: "g-old", fromWishItemId: "w1" },
  ];

  it("andere sehen, in welchen laufenden Geschenken der Wunsch übernommen ist", () => {
    expect(wishBadges({ id: "w1" }, { isOwner: false, suggestions, gifts }).map((b) => b.label)).toEqual([
      "übernommen · Geburtstag 2026",
      "übernommen · Weihnachten 2026",
    ]);
    expect(wishBadges({ id: "w2" }, { isOwner: false, suggestions, gifts })).toEqual([]);
  });

  it("Spoiler-Schutz: die Besitzerin sieht nie „übernommen“", () => {
    expect(wishBadges({ id: "w1" }, { isOwner: true, suggestions, gifts })).toEqual([]);
  });

  it("bekommen sehen alle, dann ohne „übernommen“", () => {
    const fulfilledAt = Date.parse("2025-10-08T12:00:00Z");
    const expected = [{ kind: "fulfilled", label: "bekommen 2025" }];
    expect(wishBadges({ id: "w1", fulfilledAt }, { isOwner: true, suggestions, gifts })).toEqual(expected);
    expect(wishBadges({ id: "w1", fulfilledAt }, { isOwner: false, suggestions, gifts })).toEqual(expected);
  });
});

describe("addedByLabel", () => {
  const names = { ben: { name: "Ben" }, anna: { name: "Anna" } };

  it("fremd eingetragen → „notiert von Ben“ (für alle, auch die Besitzerin)", () => {
    expect(addedByLabel({ personId: "anna", addedBy: "ben" }, names, "anna")).toBe("notiert von Ben");
    expect(addedByLabel({ personId: "anna", addedBy: "ben" }, names, null)).toBe("notiert von Ben");
  });

  it("selbst notiert → „notiert von dir“", () => {
    expect(addedByLabel({ personId: "anna", addedBy: "ben" }, names, "ben")).toBe("notiert von dir");
  });

  it("eigener Wunsch, Altbestand oder gelöschte Person → nichts", () => {
    expect(addedByLabel({ personId: "anna", addedBy: "anna" }, names, "ben")).toBeNull();
    expect(addedByLabel({ personId: "anna" }, names, "ben")).toBeNull();
    expect(addedByLabel({ personId: "anna", addedBy: "weg" }, names, "ben")).toBeNull();
  });
});

describe("wishStripSummary", () => {
  const suggestions = [
    { id: "s1", giftId: "g1", fromWishItemId: "w1" },
    { id: "s2", giftId: "g1" },
    { id: "s3", giftId: "g2", fromWishItemId: "w2" },
  ];

  it("zählt nur aktuelle Wünsche und Übernahmen in diesem Geschenk", () => {
    const wishes = [{ id: "w1" }, { id: "w2" }, { id: "w3", fulfilledAt: 1 }];
    expect(wishStripSummary(wishes, suggestions, "g1")).toBe("2 Wünsche · 1 übernommen");
    expect(wishStripSummary(wishes, suggestions, "g3")).toBe("2 Wünsche");
  });

  it("Einzahl und leer", () => {
    expect(wishStripSummary([{ id: "w9" }], suggestions, "g1")).toBe("1 Wunsch");
    expect(wishStripSummary([{ id: "w3", fulfilledAt: 1 }], suggestions, "g1")).toBe("noch keine Wünsche");
  });
});
