// Trigger auf groups/{gid}/polls/{giftId}: Start-Push an die Wahlberechtigten.
// Context7: firebase-functions v2 (onDocumentWritten, event.data.before/after).
//
// Nur `started` löst etwas aus. `closed` (Timer/manuell) bewusst OHNE Push
// (Spec §1: kein Ergebnis-Push); Stimmen, Verlängern und Verwerfen ergeben
// in classifyTransition ohnehin null. Trigger laufen at-least-once → der
// Marker _push/poll_started-{giftId}-{startedAt} verhindert Doppel-Pushes.
// Marker liegen bewusst NICHT im Poll-Doc (sonst neuer Trigger + Archiv-Eintrag).

import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { classifyTransition, normalizePoll, pollPhase } from "../shared/poll";
import { readGift } from "./pollPush";
import { sendPollPush, type PollPushDeps, type PollPushResult } from "./sendPollPush";

const REGION = "europe-west1"; // wie index.ts

export type PollWriteResult = PollPushResult | { sent: 0; skipped: "no-start" | "not-running" | "gift-not-open" };

/** Kern des Triggers (injizierbar/testbar): before/after = rohe Doc-Daten oder undefined. */
export async function handlePollWrite(
  deps: PollPushDeps,
  input: { groupId: string; giftId: string; before: unknown; after: unknown; now: number },
): Promise<PollWriteResult> {
  const { groupId, giftId, now } = input;
  const before = input.before ? normalizePoll(input.before) : null;
  const after = input.after ? normalizePoll(input.after) : null;
  if (!after || classifyTransition(before, after) !== "started") return { sent: 0, skipped: "no-start" };
  if (pollPhase(after, now) !== "running") return { sent: 0, skipped: "not-running" };

  const giftSnap = await deps.db.doc(`groups/${groupId}/gifts/${giftId}`).get();
  const gift = giftSnap.exists ? readGift(giftSnap.data()) : null;
  if (!gift || gift.status !== "open") return { sent: 0, skipped: "gift-not-open" };

  return sendPollPush(deps, { groupId, giftId, gift, poll: after, kind: "poll_started", now });
}

export const onPollWritten = onDocumentWritten(
  // retry: Wirft der Versand, gibt sendPollPush den Marker frei und die erneute
  // Zustellung holt den Start-Push nach; endet die Runde, bricht not-running ab.
  { document: "groups/{groupId}/polls/{giftId}", region: REGION, retry: true },
  async (event) => {
    const { groupId, giftId } = event.params;
    const before = event.data?.before;
    const after = event.data?.after;
    const res = await handlePollWrite(
      { db: getFirestore() },
      {
        groupId,
        giftId,
        before: before?.exists ? before.data() : undefined,
        after: after?.exists ? after.data() : undefined,
        now: Date.now(),
      },
    );
    if (res.sent > 0 || res.skipped === "duplicate" || res.skipped === "no-recipients") {
      logger.info("onPollWritten: poll_started", { groupId, giftId, ...res });
    }
  },
);
