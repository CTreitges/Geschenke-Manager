import type { Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { verifyPassword } from "./password";
import { releaseJoinAttempt, reserveJoinAttempt, type JoinCaller, type LimitScope } from "./rateLimit";

export interface JoinDeps {
  now?: () => number;
  /** Eine Zeile je Rate-Limit-Ablehnung; nie Passwort, Gruppen-ID oder IP. */
  logRateLimited?: (info: { uid: string; scope: LimitScope }) => void;
}

/**
 * Kern von joinGroup (index.ts prüft Auth und Eingaben). Jeder Versuch wird
 * vor der Passwortprüfung gezählt; ab der Grenze wird abgelehnt, auch mit
 * richtigem Passwort – sonst ließe sich die Sperre durch Weiterprobieren
 * testen. Unbekannte Gruppen zählen mit (Gruppen-IDs nicht durchprobierbar).
 */
export async function runJoinGroup(
  db: Firestore,
  caller: JoinCaller,
  groupId: string,
  password: string,
  deps: JoinDeps = {},
): Promise<{ ok: true }> {
  const now = deps.now ?? Date.now;
  const blocked = await reserveJoinAttempt(db, caller, now());
  if (blocked) {
    deps.logRateLimited?.({ uid: caller.uid, scope: blocked });
    throw new HttpsError("resource-exhausted", "Too many attempts, try again later");
  }

  const groupSnap = await db.doc(`groups/${groupId}`).get();
  if (!groupSnap.exists) {
    throw new HttpsError("not-found", "Group not found");
  }

  await verifyPassword(db, groupId, password);

  await db.doc(`groups/${groupId}/members/${caller.uid}`).set({ joinedAt: now(), uid: caller.uid }, { merge: true });
  await releaseJoinAttempt(db, caller, now());
  return { ok: true };
}
