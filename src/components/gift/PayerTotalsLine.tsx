import { Avatar } from "@/components/ui";
import { formatEuro } from "@/lib/money";
import type { Suggestion, Person } from "@/lib/types";

// ── Dezente Bezahler-Summen-Zeile ─────────────────────────────
// Eine schlanke Zeile in der Jetzt-Karte (Erhalten): pro Person ein
// kleiner Avatar + Name + Summe. Erscheint nur, sobald mindestens ein
// paidBy gesetzt ist.
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-fg-muted">
      <span className="shrink-0">💶 Bezahlt:</span>
      {payers.map(([pid, total]) => {
        const p = personsById[pid];
        return (
          <span key={pid} className="inline-flex items-center gap-1">
            {p && <Avatar person={p} size={16} />}
            <span className="text-fg-soft">{p?.name ?? "?"}</span>
            <span className="font-semibold tabular-nums text-fg">{formatEuro(total)}</span>
          </span>
        );
      })}
    </div>
  );
}
