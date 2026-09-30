// Reine Entscheidung für den archiveGroupDocChange-Trigger (ohne Firestore
// testbar).

/** Group-Subcollections, deren Vorher-Stand bei Änderung/Löschung nach
 *  groups/{groupId}/_archive wandert. */
export const ARCHIVABLE_COLLECTIONS = new Set([
  "gifts",
  "persons",
  "suggestions",
  "wishlist",
  "polls",
]);

type DocData = Record<string, unknown> | undefined;

/**
 * Soll der Vorher-Stand eines Writes archiviert werden?
 * - Nur Collections aus ARCHIVABLE_COLLECTIONS.
 * - Anlage (kein Vorher-Stand): nein — es gibt nichts wiederherzustellen.
 * - Löschung: ja.
 * - polls: nur bei einem Statuswechsel (auch erstes Setzen des Status),
 *   nicht bei jeder Stimme — sonst erzeugt jede Stimme ein Archiv-Doc.
 * - Alle anderen: jede Änderung.
 */
export function shouldArchive(collection: string, before: DocData, after: DocData): boolean {
  if (!ARCHIVABLE_COLLECTIONS.has(collection)) return false;
  if (!before) return false;
  if (!after) return true;
  if (collection === "polls") return before.status !== after.status;
  return true;
}
