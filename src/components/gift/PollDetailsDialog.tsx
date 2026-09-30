import { Avatar, Dialog } from "@/components/ui";
import type { Person, Suggestion } from "@/lib/types";

// ── Poll-Details Modal ────────────────────────────────────────
export function PollDetailsDialog({
  open,
  onClose,
  totalVotes,
  giftSuggestions,
  voteTally,
  persons,
}: {
  open: boolean;
  onClose: () => void;
  totalVotes: number;
  giftSuggestions: Suggestion[];
  voteTally: Record<string, string[]>;
  persons: Person[];
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Abstimmungs-Ergebnis">
      <div className="space-y-3">
        <div className="text-sm text-stone-500 dark:text-stone-400">
          {totalVotes} {totalVotes === 1 ? "Stimme" : "Stimmen"} insgesamt
        </div>
        {[...giftSuggestions]
          .sort((a, b) => (voteTally[b.id]?.length ?? 0) - (voteTally[a.id]?.length ?? 0))
          .map((s) => {
            const voters = voteTally[s.id] || [];
            const pct = totalVotes ? Math.round((voters.length / totalVotes) * 100) : 0;
            return (
              <div
                key={s.id}
                className="px-3.5 py-3 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-stone-900 dark:text-stone-50">
                    {s.title}
                  </div>
                  <div className="text-sm font-bold tabular-nums text-violet-700 dark:text-violet-300">
                    {pct}% · {voters.length}
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-600 to-violet-600"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {voters.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {voters.map((vid) => {
                      const v = persons.find((p) => p.id === vid);
                      return v ? (
                        <span
                          key={vid}
                          className="inline-flex items-center gap-1 text-xs text-stone-600 dark:text-stone-300"
                        >
                          <Avatar person={v} size={18} />
                          {v.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </Dialog>
  );
}
