import type { Firestore } from "firebase-admin/firestore";
import type { PushMember } from "./recipients";

/**
 * Liest groups/{gid}/members als PushMember-Liste (UID = Doc-ID).
 * Unbekannte Werte fallen weg; `notifyStack` ist nur bei explizit true an,
 * `notifyPolls` bleibt undefined, solange nie gesetzt (erbt dann notifyStack).
 */
export async function loadPushMembers(db: Firestore, groupId: string): Promise<PushMember[]> {
  const snap = await db.collection(`groups/${groupId}/members`).get();
  return snap.docs.map((d) => {
    const m = (d.data() ?? {}) as Partial<PushMember>;
    return {
      uid: d.id,
      identityPersonId: typeof m.identityPersonId === "string" ? m.identityPersonId : undefined,
      notifyStack: m.notifyStack === true,
      notifyPolls: typeof m.notifyPolls === "boolean" ? m.notifyPolls : undefined,
    };
  });
}
