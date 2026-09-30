import { Button } from "@/components/ui";
import type { Suggestion, Poll } from "@/lib/types";

// ── Closed-poll summary (compact) ─────────────────────────────
export function ClosedPollSummary({
  poll: _poll,
  tally,
  totalVotes,
  winnerId,
  suggestions,
  onOpenDetails,
  onAdoptWinner,
  onReopen,
  onClear,
}: {
  poll: Poll;
  tally: Record<string, string[]>;
  totalVotes: number;
  winnerId: string | null;
  suggestions: Suggestion[];
  onOpenDetails: () => void;
  onAdoptWinner: () => void;
  onReopen: () => void;
  onClear: () => void;
}) {
  const winner = suggestions.find((s) => s.id === winnerId);
  const winnerVotes = winner ? (tally[winner.id]?.length ?? 0) : 0;
  const winnerPct = totalVotes ? Math.round((winnerVotes / totalVotes) * 100) : 0;

  return (
    <div className="space-y-2.5">
      <div className="px-3.5 py-3.5 rounded-xl bg-violet-100 dark:bg-violet-950 flex items-center gap-2.5">
        <span className="text-2xl">🏆</span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-violet-800 dark:text-violet-300">
            {winner ? winner.title : "Kein Gewinner"}
          </div>
          <div className="text-xs text-violet-700/85 dark:text-violet-400/85">
            {winnerPct}% · {winnerVotes} von {totalVotes}{" "}
            {totalVotes === 1 ? "Stimme" : "Stimmen"}
          </div>
        </div>
        <button
          onClick={onOpenDetails}
          className="text-xs font-semibold text-violet-700 dark:text-violet-300 px-2.5 py-1.5 rounded-md hover:bg-white/30 dark:hover:bg-white/10"
        >
          Details
        </button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {winner && (
          <Button size="sm" variant="secondary" onClick={onAdoptWinner}>
            Gewinner als Auswahl übernehmen
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onReopen}>
          Wieder öffnen
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          Verwerfen
        </Button>
      </div>
    </div>
  );
}
