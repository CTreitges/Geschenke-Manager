import type { Gift, ID } from "./types";

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
