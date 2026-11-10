import type { Firestore } from "firebase-admin/firestore";
import { isFreshOwnWish, type WishFreshnessLike } from "./shared/wishlist";

/**
 * Setzt die 30/14-Tage-Erinnerungsmail aus? Nur, wenn die Person selbst
 * einen frischen Wunsch auf der Liste hat (nicht bekommen, < 120 Tage alt
 * bzw. bestätigt, addedBy leer oder sie selbst). Alte Wünsche aus Vorjahren
 * und Einträge von Freunden („notiert von Ben“) zählen nicht (B27).
 */
export async function hasFreshOwnWish(
  db: Firestore,
  groupId: string,
  personId: string,
  now: number,
): Promise<boolean> {
  const snap = await db.collection(`groups/${groupId}/wishlist`).where("personId", "==", personId).get();
  return snap.docs.some((d) => isFreshOwnWish(d.data() as WishFreshnessLike, personId, now));
}
