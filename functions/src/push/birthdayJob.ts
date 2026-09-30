import type { Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  BIRTHDAY_PUSH_TTL_SECONDS,
  planBirthdayPushes,
  viennaToday,
  type BirthdayPerson,
} from "./birthday";
import { claimPushMarker } from "./markers";
import type { PushMember } from "./recipients";
import { sendAndCleanup } from "./send";
import { loadTokensByUid } from "./tokens";

/**
 * Täglicher Geburtstags-Push (notifyUpcomingBirthdays): pro Gruppe fällige
 * Personen (28–30 Tage) finden, Empfänger ohne die beschenkte Person wählen,
 * die Person selbst bekommt „In 30 Tagen hast du Geburtstag“. Pro Person und
 * Geburtstagsjahr höchstens einmal (Marker groups/{gid}/_push/birthday-…).
 */
export async function runBirthdayPush(
  db: Firestore,
  now: Date = new Date(),
): Promise<{ sent: number; groups: number }> {
  const today = viennaToday(now);
  const groupRefs = await db.collection("groups").listDocuments();
  let sent = 0;
  let groups = 0;

  for (const groupRef of groupRefs) {
    const groupId = groupRef.id;
    try {
      const personsSnap = await db.collection(`groups/${groupId}/persons`).get();
      const persons: BirthdayPerson[] = [];
      for (const p of personsSnap.docs) {
        const data = p.data() as { name?: unknown; birthday?: unknown };
        if (typeof data.birthday === "string" && typeof data.name === "string") {
          persons.push({ id: p.id, name: data.name, birthday: data.birthday });
        }
      }
      if (persons.length === 0) continue;

      const membersSnap = await db.collection(`groups/${groupId}/members`).get();
      const members: PushMember[] = membersSnap.docs.map((d) => {
        const m = d.data() as Partial<PushMember>;
        return {
          uid: d.id,
          identityPersonId: typeof m.identityPersonId === "string" ? m.identityPersonId : undefined,
          notifyStack: m.notifyStack === true,
          notifyPolls: typeof m.notifyPolls === "boolean" ? m.notifyPolls : undefined,
        };
      });
      if (!members.some((m) => m.notifyStack)) continue;

      // Tokens ALLER Mitglieder laden — auch der beschenkten Person, damit
      // ihre Geräte-Tokens unter anderen UIDs gesperrt werden können.
      const tokensByUid = await loadTokensByUid(db, members.map((m) => m.uid));
      const plans = planBirthdayPushes({ groupId, persons, members, tokensByUid, today });
      if (plans.length === 0) continue;
      groups++;

      for (const plan of plans) {
        if (!(await claimPushMarker(db, groupId, plan.markerId, "birthday"))) continue;
        for (const push of [plan.others, plan.self]) {
          if (push.tokens.length === 0) continue;
          const res = await sendAndCleanup(db, {
            groupId,
            tokens: push.tokens,
            tokensByUid,
            data: push.data,
            urgency: "normal",
            ttlSeconds: BIRTHDAY_PUSH_TTL_SECONDS,
          });
          sent += res.sent;
        }
      }
    } catch (err) {
      // Eine kaputte Gruppe darf die anderen nicht aufhalten.
      logger.error(`notifyUpcomingBirthdays: Gruppe ${groupId} fehlgeschlagen`, err);
    }
  }
  return { sent, groups };
}
