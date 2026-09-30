// Versand eines Abstimmungs-Pushes (Start oder Erinnerung) — gemeinsam für
// den Trigger onPollWritten und den Scheduler sweepPolls.

import type { Firestore } from "firebase-admin/firestore";
import { claimPushMarker } from "../push/markers";
import { loadPushMembers } from "../push/members";
import { selectRecipients } from "../push/recipients";
import { sendAndCleanup, type Transport } from "../push/send";
import { loadTokensByUid } from "../push/tokens";
import {
  countVoters,
  effectiveEndsAt,
  eligibleVoters,
  type GiftLike,
  type PollDoc,
} from "../shared/poll";
import {
  pollMarkerId,
  pollPushTtlSeconds,
  pollReminderData,
  pollStartedData,
  type PollPushKind,
} from "./pollPush";

export interface PollPushDeps {
  db: Firestore;
  /** Versand-Weg je Gruppe; fehlt er, gilt defaultTransport (FCM bzw. _debugPush im Emulator). */
  transportFor?: (groupId: string) => Transport;
}

export interface PollPushResult {
  sent: number;
  /** Warum nichts rausging (nur zur Diagnose/für Tests). */
  skipped?: "no-round" | "no-voters" | "duplicate" | "no-recipients";
}

async function personName(db: Firestore, groupId: string, personId: string | undefined): Promise<string> {
  if (!personId) return "";
  const snap = await db.doc(`groups/${groupId}/persons/${personId}`).get();
  const name = snap.exists ? (snap.data() as { name?: unknown } | undefined)?.name : undefined;
  return typeof name === "string" ? name : "";
}

/**
 * Schickt `kind` für die laufende Runde von `poll` höchstens einmal
 * (Marker _push/{kind}-{giftId}-{startedAt}). Empfänger: Wahlberechtigte
 * (Teilnehmer ohne beschenkte Person) mit Opt-in `notifyPolls ?? notifyStack`,
 * beim Start ohne den Starter (alle Geräte), bei der Erinnerung nur ohne
 * gültige Stimme. Geräte der beschenkten Person und von Mitgliedern ohne
 * Identität sind immer gesperrt, auch unter fremden UIDs (recipients.ts).
 */
export async function sendPollPush(
  deps: PollPushDeps,
  input: {
    groupId: string;
    giftId: string;
    gift: GiftLike;
    poll: PollDoc;
    kind: PollPushKind;
    now: number;
  },
): Promise<PollPushResult> {
  const { db } = deps;
  const { groupId, giftId, gift, poll, kind, now } = input;
  if (typeof poll.startedAt !== "number") return { sent: 0, skipped: "no-round" };
  const eligible = eligibleVoters(gift);
  if (eligible.length === 0) return { sent: 0, skipped: "no-voters" };

  // Marker VOR dem Laden: Doppel-Läufe (at-least-once) sparen sich alle Reads.
  // Die Erinnerung ist damit einmalig, auch wenn gerade niemand sie braucht.
  if (!(await claimPushMarker(db, groupId, pollMarkerId(kind, giftId, poll.startedAt), kind))) {
    return { sent: 0, skipped: "duplicate" };
  }

  const suggestionsSnap = await db
    .collection(`groups/${groupId}/suggestions`)
    .where("giftId", "==", giftId)
    .get();
  const suggestionIds = suggestionsSnap.docs.map((d) => d.id);

  let requireNoVote: Set<string> | undefined;
  if (kind === "poll_reminder") {
    const { missing } = countVoters(poll, eligible, suggestionIds);
    requireNoVote = new Set(eligible.filter((pid) => !missing.includes(pid)));
  }

  const members = await loadPushMembers(db, groupId);
  // Tokens ALLER Mitglieder: auch die der beschenkten Person, damit ihre
  // Geräte unter anderen UIDs gesperrt werden können.
  const tokensByUid = await loadTokensByUid(db, members.map((m) => m.uid));
  const tokens = selectRecipients({
    members,
    tokensByUid,
    kind: "poll",
    targetPersonIds: eligible,
    blockedPersonId: gift.personId,
    excludePersonIds: kind === "poll_started" && poll.startedBy ? [poll.startedBy] : [],
    requireNoVote,
  });
  if (tokens.length === 0) return { sent: 0, skipped: "no-recipients" };

  const endsAt = effectiveEndsAt(poll);
  const base = { groupId, giftId, personName: await personName(db, groupId, gift.personId), now };
  const data =
    kind === "poll_started"
      ? pollStartedData({
          ...base,
          starterName: await personName(db, groupId, poll.startedBy),
          ideaCount: suggestionIds.length,
          endsAt,
        })
      : pollReminderData({ ...base, endsAt: endsAt ?? now });

  const res = await sendAndCleanup(
    db,
    {
      groupId,
      tokens,
      tokensByUid,
      data,
      urgency: "high",
      ttlSeconds: pollPushTtlSeconds(endsAt, now),
    },
    deps.transportFor?.(groupId),
  );
  return { sent: res.sent };
}
