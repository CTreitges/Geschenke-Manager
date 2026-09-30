import { Avatar } from "@/components/ui";
import type { Suggestion, Person } from "@/lib/types";

// ── Dezente Bezahler-Summen-Zeile ─────────────────────────────
// Eine schlanke Zeile am Ende des Geschenk-Details: pro Person ein
// kleiner Avatar + Name + Summe. Erscheint nur, sobald mindestens ein
// paidBy gesetzt ist. Keine Header-Box, kein Hinweistext.
export function PayerTotalsLine({
  selectedSuggestions,
  personsById,
}: {
  selectedSuggestions: Suggestion[];
  personsById: Record<string, Person>;
}) {
  const byPayer = new Map<string, number>();
  selectedSuggestions.forEach((s) => {
    if (!s.paidBy) return;
    byPayer.set(s.paidBy, (byPayer.get(s.paidBy) ?? 0) + (s.price ?? 0));
  });
  if (byPayer.size === 0) return null;
  const payers = [...byPayer.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="px-4 pb-3">
      <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap text-[12px] text-stone-500 dark:text-stone-400">
        <span className="shrink-0">💶 Bezahlt:</span>
        {payers.map(([pid, total]) => {
          const p = personsById[pid];
          return (
            <span key={pid} className="inline-flex items-center gap-1">
              {p && <Avatar person={p} size={16} />}
              <span className="text-stone-700 dark:text-stone-200">
                {p?.name ?? "?"}
              </span>
              <span className="font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                {total} €
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
