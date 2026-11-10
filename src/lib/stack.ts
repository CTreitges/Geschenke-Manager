import { pollPhase, type PollDoc } from "@shared/poll";
import type { Gift } from "./types";

// ⋯-Menü einer Geschenk-Karte (Home und Person → Geschenke):
// „Diesmal aussetzen“ statt Löschen – das Dokument bleibt, deshalb legt
// ensureAutoGift für dieses Jahr kein neues, leeres an (B12). Löschen gibt
// es nur noch für manuell angelegte und für erhaltene Geschenke.

export const SKIP_LOCKED_REASON = "Erst die Abstimmung beenden";

export interface GiftMenuState {
  /** „Diesmal aussetzen“: available, locked (Abstimmung läuft) oder gar nicht */
  skip: "available" | "locked" | "hidden";
  /** „Wieder aufnehmen“ für ein ausgesetztes Geschenk */
  resume: boolean;
  /** „Löschen“ (mit Rückfrage) */
  remove: boolean;
}

type MenuGift = Pick<Gift, "status" | "manuallyAdded" | "skippedAt">;

export function isSkipped(gift: Pick<Gift, "skippedAt">): boolean {
  return gift.skippedAt !== undefined;
}

export function giftMenuState(gift: MenuGift, poll: PollDoc | null | undefined, now: number): GiftMenuState {
  const remove = gift.manuallyAdded || gift.status === "received";
  if (gift.status === "received") return { skip: "hidden", resume: false, remove };
  if (isSkipped(gift)) return { skip: "hidden", resume: true, remove };
  // Eine laufende Abstimmung würde für eine unsichtbare Karte weiter erinnern.
  const skip = pollPhase(poll, now) === "running" ? "locked" : "available";
  return { skip, resume: false, remove };
}
