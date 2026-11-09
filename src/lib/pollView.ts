import {
  effectiveEndsAt,
  formatEndsAt,
  formatRemaining,
  pollPhase,
  type PollDoc,
  type PollResult,
} from "@shared/poll";
import { formatEuro } from "./money";

// Reine Texte und Berechnungen für Jetzt-Karte, VoteSheet und DecisionSheet.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Countdown ohne Sekunden-Ticker: > 24 h „endet Fr 18:30“, 1–24 h
 * „noch 4 Std 12 Min“, < 1 h „noch 38 Min“ (dringend), vorbei „beendet“.
 */
export function countdown(endsAt: number, now: number): { text: string; urgent: boolean; over: boolean } {
  const left = endsAt - now;
  if (left <= 0) return { text: "beendet", urgent: false, over: true };
  if (left > DAY) return { text: formatEndsAt(endsAt, now), urgent: false, over: false };
  return { text: formatRemaining(left), urgent: left < HOUR, over: false };
}

/** „Max“, „Max und Lena“, „Max, Lena und Ben“, „Max, Lena, Ben +2“. */
export function joinNames(names: readonly string[], max = 3): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length > max) return `${names.slice(0, max).join(", ")} +${names.length - max}`;
  return `${names.slice(0, -1).join(", ")} und ${names[names.length - 1]}`;
}

/** „3 von 4 · Es fehlt: Max“ · „4 von 4 · Alle haben abgestimmt 🎉“. */
export function votersLine(voted: number, total: number, missingNames: readonly string[]): string {
  if (total === 0) return "Noch niemand darf abstimmen";
  const head = `${voted} von ${total}`;
  if (voted >= total) return `${head} · Alle haben abgestimmt 🎉`;
  if (missingNames.length === 1 && missingNames[0] === "du") return `${head} · Es fehlt nur noch deine Stimme`;
  const label = missingNames.length === 1 ? "Es fehlt" : "Es fehlen";
  return missingNames.length ? `${head} · ${label}: ${joinNames(missingNames)}` : head;
}

/** Namen zu Personen-IDs; die eigene Person steht vorn und heißt „du“. */
export function voterNames(
  ids: readonly string[],
  people: Record<string, { name: string } | undefined>,
  myId: string | null,
): string[] {
  const others = ids.filter((id) => id !== myId).map((id) => people[id]?.name ?? "?");
  return myId && ids.includes(myId) ? ["du", ...others] : others;
}

/** Stimmen pro Idee: „2 Stimmen“; der Nenner „x von y“ gehört zum Kopf des Sheets. */
export function voteCountLabel(count: number, votedTotal: number): string {
  if (votedTotal <= 0) return "noch keine Stimmen";
  return count === 1 ? "1 Stimme" : `${count} Stimmen`;
}

/** Ränge einer nach Stimmen sortierten Liste: gleiche Stimmenzahl = gleicher Rang (1, 1, 3). */
export function competitionRanks(ranked: readonly { votes: number }[]): number[] {
  const ranks: number[] = [];
  ranked.forEach((r, i) => ranks.push(i > 0 && r.votes === ranked[i - 1].votes ? ranks[i - 1] : i + 1));
  return ranks;
}

/** Anteil der Abstimmenden (Personen, nicht Stimmen) für den Balken, 0…1. */
export function voteShare(votes: number, voted: number): number {
  if (voted <= 0 || votes <= 0) return 0;
  return Math.min(1, votes / voted);
}

/** Ideen stabil sortiert: älteste zuerst, bei Gleichstand nach ID. */
export function sortIdeas<T extends { id: string; createdAt?: number }>(ideas: readonly T[]): T[] {
  return [...ideas].sort(
    (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/**
 * Vorauswahl im Entscheidungs-Sheet: bestehende Auswahl (nur noch vorhandene
 * Ideen) plus der Sieger. Gleichstand und „keine Stimmen“ wählen nichts vor.
 */
export function initialDecisionSelection(
  result: PollResult | null,
  currentSelected: readonly string[],
  ideaIds: readonly string[],
): string[] {
  const valid = new Set(ideaIds);
  const out = currentSelected.filter((id) => valid.has(id));
  if (result?.kind === "winner" && valid.has(result.id) && !out.includes(result.id)) out.push(result.id);
  return [...new Set(out)];
}

/** „Auswahl: 1 · 129 € · 32,25 € pro Person“. */
export function selectionSummary(
  selected: readonly { price?: number }[],
  participantCount: number,
): string {
  if (selected.length === 0) return "Noch nichts ausgewählt";
  const prices = selected.map((s) => s.price).filter((p): p is number => typeof p === "number");
  const head = `Auswahl: ${selected.length}`;
  if (prices.length === 0) return head;
  const total = prices.reduce((a, b) => a + b, 0);
  const perPerson = participantCount > 0 ? ` · ${formatEuro(total / participantCount)} pro Person` : "";
  return `${head} · ${formatEuro(total)}${perPerson}`;
}

/** „A & B“ bzw. „A, B & C“ für Gleichstände. */
function andList(titles: readonly string[]): string {
  if (titles.length <= 1) return titles[0] ?? "";
  return `${titles.slice(0, -1).join(", ")} & ${titles[titles.length - 1]}`;
}

/** Überschrift des Ergebnisses: 🏆 nur bei echtem Sieger. */
export function resultHeadline(result: PollResult, titleOf: (id: string) => string): string {
  if (result.kind === "winner") return `🏆 ${titleOf(result.id)}`;
  if (result.kind === "tie") return `⚖ Gleichstand: ${andList(result.ids.map(titleOf))} (je ${result.votes})`;
  return "Niemand hat abgestimmt.";
}

/**
 * Zeile unter dem Ergebnis: „beendet Fr 18:30 (Zeit abgelaufen)“ oder
 * „beendet heute 14:10 von Ben“. Auch für abgelaufene, noch nicht vom
 * Server geschlossene Runden.
 */
export function endedLine(poll: PollDoc, now: number, nameOf: (personId: string) => string | undefined): string {
  const end = effectiveEndsAt(poll);
  if (pollPhase(poll, now) === "expired" && end !== null) return `${formatEndsAt(end, now)} (Zeit abgelaufen)`;
  const at = poll.closedAt ?? end;
  const base = at !== undefined && at !== null && at < now ? formatEndsAt(at, now) : "beendet";
  if (poll.closedReason === "timeout") return `${base} (Zeit abgelaufen)`;
  const by = poll.closedBy ? nameOf(poll.closedBy) : undefined;
  return by ? `${base} von ${by}` : base;
}

/** Sammel-Toast beim Schließen des VoteSheets – nur wenn sich etwas geändert hat. */
export function voteChangeToast(before: readonly string[], after: readonly string[]): string | null {
  const a = new Set(before);
  const b = new Set(after);
  if (a.size === b.size && [...a].every((id) => b.has(id))) return null;
  if (b.size === 0) return "Stimmen zurückgenommen";
  return `Gespeichert · ${b.size} gewählt`;
}

/** Ende liegt weniger als 3 Tage vor dem (noch kommenden) Anlass → Hinweis auf Lieferzeit. */
export function endsTooLate(endsAt: number, occasion: Date | null, now: number): boolean {
  if (!occasion) return false;
  const at = occasion.getTime();
  if (at < now - DAY) return false; // Anlass schon vorbei
  return at - endsAt < 3 * DAY;
}
