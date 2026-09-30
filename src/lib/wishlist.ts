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
