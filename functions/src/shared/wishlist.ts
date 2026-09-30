// Reine Wunschlisten-Regeln, geteilt von Frontend (Alias "@shared") und Cloud
// Functions. Keine Imports aus firebase / firebase-admin / firebase-functions.

/** Ein Wunsch gilt so lange als frisch (Erinnerungs-Mail entfällt). */
export const FRESH_WISH_DAYS = 120;

const DAY = 86_400_000;

export interface WishFreshnessLike {
  createdAt: number;
  updatedAt?: number | null;
  fulfilledAt?: number | null;
  /** personId dessen, der den Wunsch notiert hat; leer = die Person selbst (Altbestand). */
  addedBy?: string | null;
}

/**
 * Frischer, eigener Wunsch: nicht erfüllt, zuletzt vor < 120 Tagen angelegt
 * oder bestätigt, und von der Person selbst eingetragen (`addedBy` leer oder
 * gleich `personId`). Nur solche Wünsche setzen die 30/14-Tage-Mail aus.
 */
export function isFreshOwnWish(wish: WishFreshnessLike, personId: string, now: number): boolean {
  if (wish.fulfilledAt) return false;
  if (wish.addedBy && wish.addedBy !== personId) return false;
  const touched = wish.updatedAt ?? wish.createdAt;
  if (typeof touched !== "number" || !Number.isFinite(touched)) return false;
  return now - touched < FRESH_WISH_DAYS * DAY;
}
