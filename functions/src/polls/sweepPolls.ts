// sweepPolls — alle 5 Minuten (Europe/Vienna): beendet abgelaufene Abstimmungen,
// schließt Waisen und Abstimmungen erledigter Geschenke stumm und verschickt
// die einmalige Erinnerung an alle, die noch nicht abgestimmt haben.
// Context7: firebase-functions v2 (onSchedule mit region/timeZone),
// firebase-admin Firestore (collectionGroup, runTransaction).
//
// KOSTEN: Das ist der 3. Cloud-Scheduler-Job neben notifyUpcomingBirthdays und
// sendBirthdayReminders. Frei sind 3 Jobs pro Billing-Account — vor dem Deploy
// prüfen, ob dort noch andere Jobs laufen (z. B. Extensions, andere Projekte);
// sonst ca. 0,10 USD/Monat. 288 Läufe/Tag bleiben bei Invocations und Reads
// weit im Freikontingent (Query nur auf status == "active").
//
// Index: fieldOverride polls.status (COLLECTION_GROUP) in firestore.indexes.json;
// die Frist wird im Code gefiltert, ein Composite-Index ist nicht nötig.
// Die UI rechnet `expired` sofort selbst, der Sweep schreibt `closed` nach.
// Kein Ergebnis-Push (Spec §1) — auch onPollWritten sendet bei `closed` nichts.

import {
  getFirestore,
  type DocumentReference,
  type Firestore,
} from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  effectiveEndsAt,
  isQuietTime,
  normalizePoll,
  pollPhase,
  reminderDueAt,
  type GiftLike,
  type PollCloseReason,
  type PollDoc,
} from "../shared/poll";
import { readGift } from "./pollPush";
import { sendPollPush, type PollPushDeps } from "./sendPollPush";

const REGION = "europe-west1"; // wie index.ts

export type SweepAction =
  | { kind: "none" }
  | { kind: "close"; reason: PollCloseReason }
  | { kind: "remind" };

/**
 * Was der Sweep mit einer Abstimmung tut (rein). `gift` null = Geschenk
 * fehlt oder ist unlesbar → Waise. Erinnert wird nur in der laufenden
 * Runde, ab `reminderDueAt` und nie in der Ruhezeit 22–8 Uhr — ein
 * verspäteter Lauf holt sie nach 8 Uhr nach, solange die Runde läuft.
 */
export function sweepAction(poll: PollDoc, gift: GiftLike | null, now: number): SweepAction {
  if (poll.status !== "active") return { kind: "none" };
  if (!gift) return { kind: "close", reason: "orphan" };
  if (gift.status === "confirmed") return { kind: "close", reason: "gift-confirmed" };
  if (gift.status === "received") return { kind: "close", reason: "gift-received" };
  if (pollPhase(poll, now) === "expired") return { kind: "close", reason: "timeout" };
  const due = reminderDueAt(poll);
  if (due !== null && now >= due && !isQuietTime(now)) return { kind: "remind" };
  return { kind: "none" };
}

async function readGiftAt(ref: DocumentReference): Promise<GiftLike | null> {
  const snap = await ref.get();
  return snap.exists ? readGift(snap.data()) : null;
}

/**
 * Schließt per Transaktion — nur, wenn die Abstimmung noch in derselben
 * Runde (`startedAt`) ist und die Entscheidung mit frischen Daten weiterhin
 * „schließen“ lautet. So überschreibt der Sweep kein zwischenzeitliches
 * Verlängern oder Neustarten. Liefert den Grund oder null.
 */
async function closeIfStill(
  db: Firestore,
  pollRef: DocumentReference,
  giftRef: DocumentReference,
  startedAt: number | undefined,
  now: number,
): Promise<PollCloseReason | null> {
  return db.runTransaction(async (tx) => {
    const pollSnap = await tx.get(pollRef);
    const giftSnap = await tx.get(giftRef);
    if (!pollSnap.exists) return null;
    const cur = normalizePoll(pollSnap.data());
    if (cur.startedAt !== startedAt) return null;
    const gift = giftSnap.exists ? readGift(giftSnap.data()) : null;
    const action = sweepAction(cur, gift, now);
    if (action.kind !== "close") return null;
    tx.update(pollRef, {
      status: "closed",
      // Zeit abgelaufen: das echte Ende, sonst jetzt.
      closedAt: action.reason === "timeout" ? (effectiveEndsAt(cur) ?? now) : now,
      closedReason: action.reason,
    });
    return action.reason;
  });
}

export interface SweepStats {
  active: number;
  legacy: number;
  closed: Partial<Record<PollCloseReason, number>>;
  reminded: number;
  sent: number;
  errors: number;
}

/** Kern von sweepPolls (injizierbar: db, Versand, Uhrzeit). */
export async function runPollSweep(deps: PollPushDeps, now: number): Promise<SweepStats> {
  const { db } = deps;
  const stats: SweepStats = { active: 0, legacy: 0, closed: {}, reminded: 0, sent: 0, errors: 0 };
  const snap = await db.collectionGroup("polls").where("status", "==", "active").get();

  for (const doc of snap.docs) {
    // Nur groups/{gid}/polls/{giftId}; Legacy-Top-Level /polls bleibt unberührt.
    const groupRef = doc.ref.parent.parent;
    if (!groupRef || groupRef.parent?.id !== "groups") {
      stats.legacy++;
      continue;
    }
    stats.active++;
    const groupId = groupRef.id;
    const giftId = doc.id;
    try {
      const poll = normalizePoll(doc.data());
      const giftRef = db.doc(`groups/${groupId}/gifts/${giftId}`);
      const gift = await readGiftAt(giftRef);
      const action = sweepAction(poll, gift, now);

      if (action.kind === "close") {
        // Stumm schließen: onPollWritten sendet bei `closed` nichts.
        const reason = await closeIfStill(db, doc.ref, giftRef, poll.startedAt, now);
        if (reason) stats.closed[reason] = (stats.closed[reason] ?? 0) + 1;
      } else if (action.kind === "remind" && gift) {
        const res = await sendPollPush(deps, { groupId, giftId, gift, poll, kind: "poll_reminder", now });
        if (res.skipped !== "duplicate") stats.reminded++;
        stats.sent += res.sent;
      }
    } catch (err) {
      // Eine kaputte Abstimmung darf die anderen nicht aufhalten.
      stats.errors++;
      logger.error(`sweepPolls: ${groupId}/${giftId} fehlgeschlagen`, err);
    }
  }
  return stats;
}

export const sweepPolls = onSchedule(
  { region: REGION, schedule: "every 5 minutes", timeZone: "Europe/Vienna" },
  async () => {
    const stats = await runPollSweep({ db: getFirestore() }, Date.now());
    const closed = Object.values(stats.closed).reduce((a, b) => a + (b ?? 0), 0);
    if (closed > 0 || stats.reminded > 0 || stats.errors > 0) logger.info("sweepPolls", stats);
  },
);
