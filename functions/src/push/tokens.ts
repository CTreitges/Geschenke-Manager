import type { Firestore } from "firebase-admin/firestore";

/**
 * Liest pushTokens/{uid} für die gegebenen UIDs. Jeder Key des Docs ist ein
 * FCM-Token (Wert = Metadaten wie ua/addedAt/lastSeenAt). UIDs ohne Doc
 * fehlen im Ergebnis. Doppelte UIDs werden nur einmal gelesen; die
 * Deduplizierung gleicher Tokens über mehrere UIDs passiert in recipients.ts.
 */
export async function loadTokensByUid(
  db: Firestore,
  uids: string[],
): Promise<Record<string, string[]>> {
  const unique = [...new Set(uids.filter((u) => !!u))];
  if (unique.length === 0) return {};
  const snaps = await db.getAll(...unique.map((uid) => db.doc(`pushTokens/${uid}`)));
  const out: Record<string, string[]> = {};
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const keys = Object.keys(snap.data() ?? {}).filter((k) => k.length > 0);
    if (keys.length > 0) out[snap.id] = keys;
  }
  return out;
}
