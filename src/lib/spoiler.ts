import { daysUntilForGift, formatShortDate, giftDate } from "./birthdays";
import type { Gift, ID, Person } from "./types";

// Spoiler-Schutz: Die Identität ist ein selbst gewähltes Label (Trust-Prinzip).
// Diese Funktionen verhindern versehentliches Spoilern in der UI – ohne
// Identität greift kein Schutz (dann "none").

/** none = nicht mein Geschenk · planning = open/confirmed · handedOver = received. */
export type SurprisePhase = "none" | "planning" | "handedOver";

/** true, wenn die aktuelle Identität die beschenkte Person dieses Geschenks ist. */
export function isRecipient(
  gift: Pick<Gift, "personId"> | null | undefined,
  myId: ID | null | undefined,
): boolean {
  return !!gift && !!myId && gift.personId === myId;
}

export function surprisePhase(
  gift: Pick<Gift, "personId" | "status"> | null | undefined,
  myId: ID | null | undefined,
): SurprisePhase {
  if (!gift || !isRecipient(gift, myId)) return "none";
  // „bestätigt“ verrät schon etwas → bleibt Planung bis zur Übergabe.
  return gift.status === "received" ? "handedOver" : "planning";
}

/** IDs aller Geschenke, die gerade geheim für mich geplant werden. */
export function mySurpriseGiftIds(
  gifts: readonly Pick<Gift, "id" | "personId" | "status">[],
  myId: ID | null | undefined,
): Set<ID> {
  return new Set(gifts.filter((g) => surprisePhase(g, myId) === "planning").map((g) => g.id));
}

// ─── Schreib-Guard ──────────────────────────────────────

export const RECIPIENT_BLOCKED = "Das ist deine eigene Überraschung – hier kannst du nichts eintragen.";

/** Sicherheitsnetz in storage.ts: Stimme, Idee oder Übernahme nie als beschenkte Person. */
export function assertNotRecipient(
  gift: Pick<Gift, "personId"> | null | undefined,
  personId: ID | null | undefined,
): void {
  if (isRecipient(gift, personId)) throw new Error(RECIPIENT_BLOCKED);
}

// ─── Hinweise für die beschenkte Person ─────────────────

/** Meine nächste laufende Überraschung (frühestes Datum) samt Datum – oder null. */
export function nextSurprise<G extends Gift>(
  gifts: readonly G[],
  persons: readonly Person[],
  myId: ID | null | undefined,
  ref: Date = new Date(),
): { gift: G; date: Date | null } | null {
  const me = persons.find((p) => p.id === myId);
  const mine = gifts.filter((g) => surprisePhase(g, myId) === "planning");
  if (mine.length === 0) return null;
  const [gift] = [...mine].sort((a, b) => daysUntilForGift(a, me, ref) - daysUntilForGift(b, me, ref));
  return { gift, date: giftDate(gift, me, ref) };
}

/** „deinen Geburtstag“ bzw. den Anlass in Anführungszeichen („Hochzeit“). */
export function surpriseOccasion(occasion: string | undefined): string {
  const occ = occasion?.trim();
  return !occ || occ === "Geburtstag" ? "deinen Geburtstag" : `„${occ}“`;
}

/** Banner auf der eigenen Wunschliste, z. B. „🤫 Für deinen Geburtstag am 8. Okt wird schon geplant – …“. */
export function surpriseBanner(occasion: string | undefined, date: Date | null): string {
  const day = date ? ` am ${formatShortDate(date)}` : "";
  return `🤫 Für ${surpriseOccasion(occasion)}${day} wird schon geplant – ergänze gern Wünsche.`;
}
