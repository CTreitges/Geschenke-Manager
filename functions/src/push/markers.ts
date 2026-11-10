import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";

/**
 * Idempotenz-Marker unter groups/{gid}/_push/{key}: create() schlägt mit
 * ALREADY_EXISTS fehl, wenn das Ereignis schon verschickt wurde (Scheduler
 * und Trigger laufen at-least-once). true = wir dürfen senden.
 * `_push` hat keine Client-Regel (Default-Deny) und wird von deleteGroup
 * rekursiv mitgelöscht.
 */
export async function claimPushMarker(
  db: Firestore,
  groupId: string,
  key: string,
  kind: string,
): Promise<boolean> {
  try {
    await db.doc(`groups/${groupId}/_push/${key}`).create({
      at: FieldValue.serverTimestamp(),
      kind,
    });
    return true;
  } catch (err) {
    if (isAlreadyExists(err)) return false;
    throw err;
  }
}

/**
 * Gibt einen geclaimten Marker wieder frei, wenn nach dem Claim etwas
 * geworfen hat (Reads, FCM-Auth/Netz) — sonst wäre das Ereignis endgültig
 * verloren, obwohl der nächste Lauf es nachholen könnte. Best-effort: ein
 * Fehler hier wird nur geloggt, der ursprüngliche Fehler zählt.
 */
export async function releasePushMarker(db: Firestore, groupId: string, key: string): Promise<void> {
  try {
    await db.doc(`groups/${groupId}/_push/${key}`).delete();
  } catch (err) {
    logger.warn(`Push-Marker ${groupId}/${key} nicht freigegeben`, err);
  }
}

export function isAlreadyExists(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === 6 || code === "already-exists" || code === "ALREADY_EXISTS";
}
