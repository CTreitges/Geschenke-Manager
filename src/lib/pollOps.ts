import {
  effectiveEndsAt,
  eligibleVoters,
  pollPhase,
  type GiftLike,
  type GiftLocks,
  type PollCloseReason,
  type PollDoc,
} from "@shared/poll";

// Reine Bausteine für die Poll-Schreib-API in storage.ts: welche Felder ein
// Start, ein Ende oder eine Verlängerung schreibt und wann eine Aktion
// gesperrt ist. Keine Firebase-Imports – die Uhrzeit kommt als `now`.

export type LockedAction = keyof GiftLocks;

const LOCK_MESSAGES: Record<LockedAction, string> = {
  addIdea: "Neue Ideen sind pausiert, bis die Abstimmung endet.",
  adoptWish: "Übernehmen geht wieder, sobald die Abstimmung endet.",
  editIdea: "Ideen lassen sich erst nach der Abstimmung bearbeiten.",
  deleteIdea: "Ideen lassen sich erst nach der Abstimmung löschen.",
  decideOutsideResult: "Erst die Abstimmung beenden.",
};

export function lockMessage(action: LockedAction): string {
  return LOCK_MESSAGES[action];
}

/** Wird von addSuggestion & Co. geworfen, solange die Abstimmung läuft. */
export class PollLockedError extends Error {
  readonly action: LockedAction;
  constructor(action: LockedAction) {
    super(lockMessage(action));
    this.name = "PollLockedError";
    this.action = action;
  }
}

/** Nur „Bezahlt von“ ändern bleibt auch während der Abstimmung erlaubt. */
export function isPaidByOnlyPatch(patch: Record<string, unknown>): boolean {
  const keys = Object.keys(patch);
  return keys.length > 0 && keys.every((k) => k === "paidBy");
}

/** Vollständiges Doc einer neuen Runde (setDoc OHNE merge: alte Stimmen sind weg). */
export function newPollDoc(
  giftId: string,
  opts: { now: number; durationMs: number; startedBy: string },
): PollDoc & { giftId: string } {
  return {
    giftId,
    status: "active",
    startedAt: opts.now,
    startedBy: opts.startedBy,
    endsAt: opts.now + opts.durationMs,
    votes: {},
  };
}

export interface CloseFields {
  status: "closed";
  closedAt: number;
  closedReason: PollCloseReason;
  closedBy?: string;
}

/**
 * Felder zum Schließen. Ist die Frist schon abgelaufen, hat der Timer die
 * Runde beendet (timeout, closedAt = Frist) – egal, wer gerade schließt.
 */
export function closeFields(
  poll: Pick<PollDoc, "status" | "startedAt" | "endsAt" | "votes">,
  by: { closedBy?: string | null; reason: PollCloseReason },
  now: number,
): CloseFields {
  const end = effectiveEndsAt(poll);
  if (end !== null && pollPhase(poll as PollDoc, now) === "expired") {
    return { status: "closed", closedAt: end, closedReason: "timeout" };
  }
  const out: CloseFields = { status: "closed", closedAt: now, closedReason: by.reason };
  if (by.closedBy) out.closedBy = by.closedBy;
  return out;
}

/**
 * Neue Frist beim Verlängern: eine laufende Runde ab der bisherigen Frist
 * (mindestens ab jetzt). `reopen` = die Runde war beendet und wird wieder
 * aktiv (Stimmen bleiben) – dann immer ab jetzt, auch wenn sie vorzeitig
 * beendet wurde und die alte Frist noch in der Zukunft läge.
 */
export function extendedEndsAt(
  poll: Pick<PollDoc, "status" | "startedAt" | "endsAt">,
  addMs: number,
  now: number,
): { endsAt: number; reopen: boolean } {
  const reopen = poll.status !== "active";
  const base = reopen ? now : Math.max(effectiveEndsAt(poll) ?? now, now);
  return { endsAt: base + addMs, reopen };
}

export const POLL_ALREADY_RUNNING = "Hier läuft schon eine Abstimmung – stimm einfach mit ab.";

/**
 * Prüfung in der Start-Transaktion: eine laufende Runde (frisch vom Server
 * gelesen) wird nie überschrieben – sonst wären ihre Stimmen weg.
 */
export function assertCanStartPoll(poll: PollDoc | null | undefined, now: number): void {
  if (pollPhase(poll, now) === "running") throw new Error(POLL_ALREADY_RUNNING);
}

/**
 * Personen, deren Stimme im Doc noch im Alt-Format steht (String statt
 * Liste). Für sie schreibt setMyVote die ganze Liste – arrayUnion auf einen
 * String würde die alte Stimme überschreiben.
 */
export function legacyVoterIds(rawVotes: unknown): string[] {
  if (!rawVotes || typeof rawVotes !== "object") return [];
  return Object.entries(rawVotes as Record<string, unknown>)
    .filter(([, v]) => !Array.isArray(v))
    .map(([pid]) => pid);
}

/** Eigene Stimmen nach einem Tipp: `sid` an bzw. aus, ohne Doppelte. */
export function toggledVotes(current: readonly string[], sid: string, on: boolean): string[] {
  const rest = [...new Set(current)].filter((x) => x !== sid);
  return on ? [...rest, sid] : rest;
}

/**
 * Grund, warum ich gerade keine Abstimmung starten kann – oder null.
 * Reihenfolge = was man zuerst tun muss.
 */
export function startPollBlocker(
  gift: GiftLike,
  ideaCount: number,
  myId: string | null | undefined,
): string | null {
  if (!myId) return "Wähle erst, wer du bist.";
  if (myId === gift.personId) return "Das ist dein eigenes Geschenk.";
  if (gift.status !== "open") return "Das Geschenk ist schon entschieden.";
  if (!(gift.participantIds ?? []).includes(myId)) return "Mach erst selbst mit, dann kannst du starten.";
  if (ideaCount < 2) return "Dafür braucht es mindestens 2 Ideen.";
  if (eligibleVoters(gift).length < 2) return "Dafür braucht es mindestens 2 Teilnehmer.";
  return null;
}

/** Läuft die Abstimmung (Frist offen)? Dann ist das Poll-Doc eingefroren bis auf Stimmen. */
export function isRunning(poll: PollDoc | null | undefined, now: number): boolean {
  return pollPhase(poll, now) === "running";
}
