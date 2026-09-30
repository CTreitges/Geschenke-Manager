import type { Gift, ID, Person, Suggestion, WishlistItem } from "./types";

// Was beim Löschen einer Person bzw. beim Aufräumen doppelter Geschenke
// mitgeht – rein, damit storage.ts nur noch den Batch ausführt und nichts
// verwaist zurückbleibt (B30). Poll-Doc-ID = Geschenk-ID.

type GiftLike = Pick<Gift, "id" | "personId" | "participantIds">;

export interface PersonDeletion {
  gifts: ID[];
  suggestions: ID[];
  /** Poll-Docs der Geschenke (Löschen eines fehlenden Docs ist ein No-op). */
  polls: ID[];
  wishlist: ID[];
  /** Andere Geschenke, bei denen die Person Teilnehmerin ist (arrayRemove). */
  participantOf: ID[];
  /** Andere Personen, bei denen sie als Standard-Teilnehmerin eingetragen ist (arrayRemove). */
  defaultParticipantOf: ID[];
}

/**
 * Person weg → ihre Geschenke samt Ideen und Abstimmungen und ihre Wünsche;
 * aus fremden Geschenken und Standard-Teilnehmern wird sie ausgetragen
 * (sonst zählt sie als „Geist“ bei „x von y“, Budget und neuen Geschenken).
 * Ihre Stimmen bleiben stehen: gezählt wird nur, wer Teilnehmer ist.
 */
export function personDeletion(
  personId: ID,
  data: {
    gifts: readonly GiftLike[];
    suggestions: readonly Pick<Suggestion, "id" | "giftId">[];
    wishlist: readonly Pick<WishlistItem, "id" | "personId">[];
    persons?: readonly Pick<Person, "id" | "defaultParticipantIds">[];
  },
): PersonDeletion {
  const gifts = data.gifts.filter((g) => g.personId === personId).map((g) => g.id);
  const giftIds = new Set(gifts);
  return {
    gifts,
    suggestions: data.suggestions.filter((s) => giftIds.has(s.giftId)).map((s) => s.id),
    polls: gifts,
    wishlist: data.wishlist.filter((w) => w.personId === personId).map((w) => w.id),
    participantOf: data.gifts
      .filter((g) => !giftIds.has(g.id) && (g.participantIds ?? []).includes(personId))
      .map((g) => g.id),
    defaultParticipantOf: (data.persons ?? [])
      .filter((p) => p.id !== personId && (p.defaultParticipantIds ?? []).includes(personId))
      .map((p) => p.id),
  };
}

/**
 * Geschenk ohne verwaiste Teilnehmer (gelöschte Personen aus Altbeständen) –
 * für alles, was die UI zählt: Wahlberechtigte, „x von y“, Budget, Pro-Kopf.
 * Gibt dasselbe Objekt zurück, wenn nichts fehlt.
 */
export function withLiveParticipants<G extends Pick<Gift, "participantIds">>(gift: G, personIds: ReadonlySet<ID>): G {
  const live = gift.participantIds.filter((id) => personIds.has(id));
  return live.length === gift.participantIds.length ? gift : { ...gift, participantIds: live };
}

export interface DedupPlan {
  /** Doppelte Geschenke, die wegfallen (ihre Poll-Docs gleich mit). */
  gifts: ID[];
  /** Ideen der wegfallenden Geschenke wandern zum behaltenen – nichts geht verloren. */
  moves: { id: ID; giftId: ID }[];
}

type DedupGift = Pick<
  Gift,
  | "id"
  | "personId"
  | "year"
  | "status"
  | "participantIds"
  | "selectedSuggestionIds"
  | "enteredStackAt"
  | "manuallyAdded"
  | "occasion"
  | "skippedAt"
>;

/**
 * Doppelte Auto-Geschenke (offen, gleiche Person + Jahr + Anlass): das
 * „reichste“ bleibt (Teilnehmer + halbe Auswahl, bei Gleichstand das
 * ältere), der Rest fällt weg. Nie angefasst werden manuell angelegte
 * („Hochzeit“ im selben Jahr), ausgesetzte und solche mit laufender
 * Abstimmung (`runningGiftIds`) – deren Ideen würden sonst die Sperre umgehen.
 */
export function dedupPlan(
  gifts: readonly DedupGift[],
  suggestions: readonly Pick<Suggestion, "id" | "giftId">[],
  runningGiftIds: ReadonlySet<ID> = new Set(),
): DedupPlan {
  const groups = new Map<string, DedupGift[]>();
  for (const g of gifts) {
    if (g.status !== "open" || g.manuallyAdded || g.skippedAt !== undefined || runningGiftIds.has(g.id)) continue;
    const key = `${g.personId}:${g.year}:${g.occasion?.trim() || "Geburtstag"}`;
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
