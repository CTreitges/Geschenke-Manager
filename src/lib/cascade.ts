import type { Gift, ID, Suggestion, WishlistItem } from "./types";

// Was beim Löschen einer Person bzw. beim Aufräumen doppelter Geschenke
// mitgeht – rein, damit storage.ts nur noch den Batch ausführt und nichts
// verwaist zurückbleibt (B30). Poll-Doc-ID = Geschenk-ID.

type GiftLike = Pick<Gift, "id" | "personId">;

export interface PersonDeletion {
  gifts: ID[];
  suggestions: ID[];
  /** Poll-Docs der Geschenke (Löschen eines fehlenden Docs ist ein No-op). */
  polls: ID[];
  wishlist: ID[];
}

/** Person weg → ihre Geschenke samt Ideen und Abstimmungen und ihre Wünsche. */
export function personDeletion(
  personId: ID,
  data: {
    gifts: readonly GiftLike[];
    suggestions: readonly Pick<Suggestion, "id" | "giftId">[];
    wishlist: readonly Pick<WishlistItem, "id" | "personId">[];
  },
): PersonDeletion {
  const gifts = data.gifts.filter((g) => g.personId === personId).map((g) => g.id);
  const giftIds = new Set(gifts);
  return {
    gifts,
    suggestions: data.suggestions.filter((s) => giftIds.has(s.giftId)).map((s) => s.id),
    polls: gifts,
    wishlist: data.wishlist.filter((w) => w.personId === personId).map((w) => w.id),
  };
}

export interface DedupPlan {
  /** Doppelte Geschenke, die wegfallen (ihre Poll-Docs gleich mit). */
  gifts: ID[];
  /** Ideen der wegfallenden Geschenke wandern zum behaltenen – nichts geht verloren. */
  moves: { id: ID; giftId: ID }[];
}

type DedupGift = Pick<Gift, "id" | "personId" | "year" | "status" | "participantIds" | "selectedSuggestionIds" | "enteredStackAt">;

/**
 * Offene Geschenke mit gleicher Person + Jahr: das „reichste“ bleibt
 * (Teilnehmer + halbe Auswahl, bei Gleichstand das ältere), der Rest fällt weg.
 */
export function dedupPlan(
  gifts: readonly DedupGift[],
  suggestions: readonly Pick<Suggestion, "id" | "giftId">[],
): DedupPlan {
  const groups = new Map<string, DedupGift[]>();
  for (const g of gifts) {
    if (g.status !== "open") continue;
    const key = `${g.personId}:${g.year}`;
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }
  const weight = (g: DedupGift) => g.participantIds.length + (g.selectedSuggestionIds?.length ?? 0) * 0.5;
  const plan: DedupPlan = { gifts: [], moves: [] };
  for (const arr of groups.values()) {
    if (arr.length < 2) continue;
    const [keep, ...drop] = [...arr].sort((a, b) => weight(b) - weight(a) || a.enteredStackAt - b.enteredStackAt);
    const dropIds = new Set(drop.map((g) => g.id));
    plan.gifts.push(...dropIds);
    for (const s of suggestions) if (dropIds.has(s.giftId)) plan.moves.push({ id: s.id, giftId: keep.id });
  }
  return plan;
}
