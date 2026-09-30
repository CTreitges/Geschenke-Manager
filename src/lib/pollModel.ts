import {
  canVote,
  countVoters,
  effectiveEndsAt,
  eligibleVoters,
  getGiftLocks,
  pollPhase,
  pollResult,
  ranking,
  tally,
  type GiftLocks,
  type PollDoc,
  type PollPhase,
  type PollResult,
  type RankedSuggestion,
} from "@shared/poll";
import { isRecipient } from "./spoiler";
import type { Gift, ID, Suggestion } from "./types";

// Alles, was Jetzt-Karte, Ideen-Liste und die Sheets über die Abstimmung
// eines Geschenks wissen müssen – einmal pro Render berechnet, rein.

export interface PollModel {
  phase: PollPhase;
  /** Gültige Frist oder null (keine Frist / Altlast). */
  endsAt: number | null;
  eligible: ID[];
  /** suggestionId → Wähler (nur existierende Ideen, nur Wahlberechtigte). */
  counts: Record<ID, ID[]>;
  ranked: RankedSuggestion[];
  /** null, solange es keine beendete Runde gibt. */
  result: PollResult | null;
  voters: { voted: number; total: number; missing: ID[] };
  /** Eigene Stimmen für noch existierende Ideen. */
  myVotes: ID[];
  canVote: boolean;
  isEligible: boolean;
  isRecipient: boolean;
  locks: GiftLocks;
}

export function pollModel(
  gift: Gift,
  poll: PollDoc | null | undefined,
  ideas: readonly Pick<Suggestion, "id" | "createdAt">[],
  myId: ID | null | undefined,
  now: number,
): PollModel {
  const phase = pollPhase(poll, now);
  const eligible = eligibleVoters(gift);
  const ids = ideas.map((s) => s.id);
  const counts = tally(poll, ids, eligible);
  const ranked = ranking(ideas, counts);
  const ended = phase === "expired" || phase === "closed";
  const valid = new Set(ids);
  const mine = (myId && poll?.votes?.[myId]) || [];
  return {
    phase,
    endsAt: poll ? effectiveEndsAt(poll) : null,
    eligible,
    counts,
    ranked,
    result: ended ? pollResult(ranked) : null,
    voters: countVoters(poll, eligible, ids),
    myVotes: [...new Set(mine)].filter((sid) => valid.has(sid)),
    canVote: canVote(gift, poll, myId, now),
    isEligible: !!myId && eligible.includes(myId),
    isRecipient: isRecipient(gift, myId),
    locks: getGiftLocks(gift, poll, now),
  };
}
