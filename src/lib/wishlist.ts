// Reine Wunschlisten-Helfer für die Anzeige. Frische für die Mail-Kopplung:
// `isFreshOwnWish` in @shared/wishlist.

/** Ein Wunsch gilt als veraltet, wenn er so lange nicht angelegt/bestätigt wurde. */
export const STALE_WISH_DAYS = 365;

const DAY = 86_400_000;

interface SortableWish {
  id: string;
  createdAt: number;
  favorite?: boolean;
}

interface WishLike extends SortableWish {
  personId: string;
  updatedAt?: number;
  fulfilledAt?: number;
  addedBy?: string;
}

interface SuggestionLike {
  id: string;
  giftId: string;
  fromWishItemId?: string;
}

interface GiftLike {
  id: string;
  year: number;
  status: string;
  occasion?: string;
  selectedSuggestionIds?: string[];
}

/** Herzenswünsche zuerst, dann die neuesten; gleicher Zeitpunkt → ID. Liefert eine Kopie. */
export function sortWishes<T extends SortableWish>(wishes: readonly T[]): T[] {
  return [...wishes].sort(
    (a, b) =>
      Number(!!b.favorite) - Number(!!a.favorite) ||
      b.createdAt - a.createdAt ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** Älter als 365 Tage seit Anlegen bzw. letztem „Noch aktuell ✓“ (`updatedAt`). */
export function isStale(wish: { createdAt: number; updatedAt?: number }, now: number): boolean {
  return now - (wish.updatedAt ?? wish.createdAt) > STALE_WISH_DAYS * DAY;
}

export interface WishGroups<T> {
  /** ⭐ Herzenswünsche (aktuell, nicht bekommen). */
  favorites: T[];
  /** Weitere Wünsche. */
  rest: T[];
  /** Älter als 12 Monate – noch aktuell? */
  stale: T[];
  /** Bekommen (fulfilledAt gesetzt, erst nach „erhalten“), zuletzt bekommene zuerst. */
  fulfilled: T[];
}

/** Aufteilung für die Listenansicht: bekommen > veraltet > Herzenswunsch > Rest. */
export function groupWishes<T extends WishLike>(wishes: readonly T[], now: number): WishGroups<T> {
  const groups: WishGroups<T> = { favorites: [], rest: [], stale: [], fulfilled: [] };
  for (const w of sortWishes(wishes)) {
    if (w.fulfilledAt) groups.fulfilled.push(w);
    else if (isStale(w, now)) groups.stale.push(w);
    else if (w.favorite) groups.favorites.push(w);
    else groups.rest.push(w);
  }
  groups.fulfilled.sort((a, b) => (b.fulfilledAt ?? 0) - (a.fulfilledAt ?? 0));
  return groups;
}

/** Deterministische ID der übernommenen Idee: Doppeltipp oder zwei Leute gleichzeitig → kein Duplikat. */
export function adoptedSuggestionId(giftId: string, wishId: string): string {
  return `wish_${giftId}_${wishId}`;
}

/** „Geburtstag 2026“, „Hochzeit 2027“. */
export function giftLabel(gift: Pick<GiftLike, "occasion" | "year">): string {
  return `${gift.occasion?.trim() || "Geburtstag"} ${gift.year}`;
}

/**
 * Wünsche, die beim „Geschenk erhalten“ als bekommen markiert werden: aus
 * ausgewählten Ideen dieses Geschenks mit fromWishItemId, deren Wunsch noch
 * existiert (ein Update auf ein gelöschtes Doc würde den Batch sprengen).
 */
export function fulfilledWishIds(
  gift: Pick<GiftLike, "id" | "selectedSuggestionIds">,
  suggestions: readonly SuggestionLike[],
  existingWishIds: ReadonlySet<string>,
): string[] {
  const selected = new Set(gift.selectedSuggestionIds ?? []);
  const ids = suggestions
    .filter((s) => s.giftId === gift.id && selected.has(s.id) && s.fromWishItemId && existingWishIds.has(s.fromWishItemId))
    .map((s) => s.fromWishItemId as string);
  return [...new Set(ids)];
}

export interface WishBadge {
  kind: "adopted" | "fulfilled";
  label: string;
}

/**
 * Status-Hinweise an einer Wunsch-Karte. Spoiler-Schutz: Die Besitzerin sieht
 * nie, ob/wo ein Wunsch übernommen wurde – „bekommen“ erst, wenn das Geschenk
 * erhalten ist (fulfilledAt wird erst dann gesetzt).
 */
export function wishBadges<G extends GiftLike>(
  wish: Pick<WishLike, "id" | "fulfilledAt">,
  opts: { isOwner: boolean; suggestions: readonly SuggestionLike[]; gifts: readonly G[] },
): WishBadge[] {
  const badges: WishBadge[] = [];
  if (!opts.isOwner && !wish.fulfilledAt) {
    const giftIds = new Set(opts.suggestions.filter((s) => s.fromWishItemId === wish.id).map((s) => s.giftId));
    for (const g of opts.gifts) {
      if (giftIds.has(g.id) && g.status !== "received") badges.push({ kind: "adopted", label: `übernommen · ${giftLabel(g)}` });
    }
  }
  if (wish.fulfilledAt) badges.push({ kind: "fulfilled", label: `bekommen ${new Date(wish.fulfilledAt).getFullYear()}` });
  return badges;
}

/** „notiert von Ben“ / „notiert von dir“ – nur, wenn jemand anderes als die Person den Wunsch eingetragen hat. */
export function addedByLabel(
  wish: Pick<WishLike, "personId" | "addedBy">,
  namesById: Readonly<Record<string, { name: string } | undefined>>,
  myId: string | null | undefined,
): string | null {
  if (!wish.addedBy || wish.addedBy === wish.personId) return null;
  if (wish.addedBy === myId) return "notiert von dir";
  const name = namesById[wish.addedBy]?.name;
  return name ? `notiert von ${name}` : null;
}

/** Zeile im Streifen „Wunschliste von Anna“: „5 Wünsche · 2 übernommen“ (nur aktuelle, nicht bekommene). */
export function wishStripSummary(
  wishes: readonly Pick<WishLike, "id" | "fulfilledAt">[],
  suggestions: readonly SuggestionLike[],
  giftId: string,
): string {
  const open = wishes.filter((w) => !w.fulfilledAt);
  if (open.length === 0) return "noch keine Wünsche";
  const adoptedIds = new Set(suggestions.filter((s) => s.giftId === giftId).map((s) => s.fromWishItemId));
  const adopted = open.filter((w) => adoptedIds.has(w.id)).length;
  const count = `${open.length} ${open.length === 1 ? "Wunsch" : "Wünsche"}`;
  return adopted > 0 ? `${count} · ${adopted} übernommen` : count;
}
