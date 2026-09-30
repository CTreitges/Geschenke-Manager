import {
  canVote,
  countVoters,
  effectiveEndsAt,
  eligibleVoters,
  formatEndsAt,
  pollPhase,
  pollResult,
  ranking,
  tally,
  type PollDoc,
  type PollResult,
} from "@shared/poll";
import { formatEuro } from "./money";
import { isRecipient } from "./spoiler";
import type { Gift, ID, Suggestion } from "./types";

// Phase eines Geschenks für die Home-Phasenzeile und den Stepper im Detail.
// Die beschenkte Person bekommt nie Details (Spoiler-Schutz).

export type GiftPhase = "ideas" | "voting" | "result" | "decided" | "received";
export type GiftPhaseBadge = "du-fehlst" | "bezahlung-offen";

/** Stufen des PhaseStepper; „result“ gehört noch zur Stufe „Abstimmung“. */
export const PHASE_STEPS = ["Ideen", "Abstimmung", "Entschieden", "Erhalten"] as const;

export interface GiftPhaseInfo {
  phase: GiftPhase;
  /** Index in PHASE_STEPS */
  step: 0 | 1 | 2 | 3;
  /** Home-Phasenzeile, z. B. „💡 3 Ideen“ oder „✓ Plattenspieler · 129 €“ */
  label: string;
  badge?: GiftPhaseBadge;
  /** true = ich bin die beschenkte Person; alle Details sind ausgeblendet. */
  surprise: boolean;
  ideaCount: number;
  /** bei voting/result: „x von y“ und wer fehlt */
  voters?: { voted: number; total: number; missing: ID[] };
  /** bei voting mit Frist */
  endsAt?: number;
  /** bei result */
  result?: PollResult;
  /** bei decided/received: Summe der ausgewählten Ideen mit Preis */
  total?: number;
}

type PhaseGift = Pick<Gift, "id" | "personId" | "status" | "participantIds" | "selectedSuggestionIds">;
type PhaseSuggestion = Pick<Suggestion, "id" | "giftId" | "title" | "price" | "createdAt" | "paidBy">;

function ideasLabel(count: number): string {
  if (count === 0) return "💡 Noch keine Ideen";
  return count === 1 ? "💡 1 Idee" : `💡 ${count} Ideen`;
}

/** „Plattenspieler“, „Plattenspieler + 2“ oder der Fallback ohne Auswahl. */
function titlesOf(selected: readonly PhaseSuggestion[], fallback: string): string {
  if (selected.length === 0) return fallback;
  const first = selected[0].title;
  return selected.length === 1 ? first : `${first} + ${selected.length - 1}`;
}

function sumPrices(selected: readonly PhaseSuggestion[]): number | undefined {
  const prices = selected.map((s) => s.price).filter((p): p is number => typeof p === "number");
  return prices.length ? prices.reduce((a, b) => a + b, 0) : undefined;
}

export function giftPhase(
  gift: PhaseGift,
  poll: PollDoc | null | undefined,
  suggestions: readonly PhaseSuggestion[],
  myId: ID | null | undefined,
  now: number,
): GiftPhaseInfo {
  const ideas = suggestions.filter((s) => s.giftId === gift.id);
  const byId = new Map(ideas.map((s) => [s.id, s]));
  const selected = (gift.selectedSuggestionIds ?? [])
    .map((id) => byId.get(id))
    .filter((s): s is PhaseSuggestion => !!s);

  if (isRecipient(gift, myId)) {
    // Nach der Übergabe nur die Titel, vorher gar nichts.
    return gift.status === "received"
      ? { phase: "received", step: 3, label: `🎁 ${titlesOf(selected, "Erhalten")}`, surprise: true, ideaCount: 0 }
      : { phase: "ideas", step: 0, label: "🤫 Überraschung läuft", surprise: true, ideaCount: 0 };
  }

  const base = { surprise: false, ideaCount: ideas.length };

  if (gift.status === "received" || gift.status === "confirmed") {
    const received = gift.status === "received";
    const total = sumPrices(selected);
    const title = `${received ? "🎁" : "✓"} ${titlesOf(selected, received ? "Erhalten" : "Entschieden")}`;
    return {
      ...base,
      phase: received ? "received" : "decided",
      step: received ? 3 : 2,
      label: total === undefined ? title : `${title} · ${formatEuro(total)}`,
      badge: selected.some((s) => !s.paidBy) ? "bezahlung-offen" : undefined,
      total,
    };
  }

  const phase = pollPhase(poll, now);
  if (phase === "none") return { ...base, phase: "ideas", step: 0, label: ideasLabel(ideas.length) };

  const eligible = eligibleVoters(gift);
  const ids = ideas.map((s) => s.id);
  const voters = countVoters(poll, eligible, ids);

  if (phase === "running") {
    const end = effectiveEndsAt(poll);
    const parts = ["⏱ Abstimmung", `${voters.voted}/${voters.total}`];
    if (end !== null) parts.push(formatEndsAt(end, now));
    const iAmMissing = !!myId && canVote(gift, poll, myId, now) && voters.missing.includes(myId);
    return {
      ...base,
      phase: "voting",
      step: 1,
      label: parts.join(" · "),
      badge: iAmMissing ? "du-fehlst" : undefined,
      voters,
      endsAt: end ?? undefined,
    };
  }

  // expired oder closed: Auswertung, Entscheidung steht noch aus.
  const result = pollResult(ranking(ideas, tally(poll, ids, eligible)));
  return {
    ...base,
    phase: "result",
    step: 1,
    label: result.kind === "winner" ? "🏆 Entscheidung offen" : "⚖ Entscheidung offen",
    voters,
    result,
  };
}
