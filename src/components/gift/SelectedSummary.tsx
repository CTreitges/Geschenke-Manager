import { Icon } from "@/components/ui";
import type { Suggestion } from "@/lib/types";

// ── Selected summary ──────────────────────────────────────────
// `provisional` schaltet das Wording um: "Theoretische Gesamtsumme" (open)
// vs. "Gesamtsumme" (confirmed/received). `allowEdit` blendet im
// confirmed/received-State die Entfernen-/Alle-löschen-Buttons aus.
export function SelectedSummary({
  selectedIds,
  suggestions,
  sum,
  provisional,
  allowEdit,
  onRemove,
  onClear,
}: {
  selectedIds: string[];
  suggestions: Suggestion[];
  sum: number;
  provisional: boolean;
  allowEdit: boolean;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const selected = selectedIds
    .map((id) => suggestions.find((s) => s.id === id))
    .filter((s): s is Suggestion => !!s);
  return (
    <div className="mt-3 px-3.5 py-3 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[13px] font-bold text-violet-700 dark:text-violet-300">
          {selected.length} ausgewählt ·{" "}
          {provisional ? "Theoretische Gesamtsumme" : "Gesamtsumme"}
        </div>
        <div className="text-[20px] font-extrabold text-violet-700 dark:text-violet-300 tabular-nums">
          {sum} €
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {selected.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-2 text-[13px] py-1"
          >
            <div className="flex-1 min-w-0 truncate text-stone-700 dark:text-stone-200">
              {s.title}
            </div>
            <span className="text-violet-700 dark:text-violet-300 font-semibold tabular-nums">
              {s.price != null ? `${s.price} €` : "—"}
            </span>
            {allowEdit && (
              <button
                onClick={() => onRemove(s.id)}
                className="text-stone-400 hover:text-red-500 px-1"
                aria-label="Aus Auswahl entfernen"
              >
                <Icon.x size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      {allowEdit && selected.length > 1 && (
        <button
          onClick={onClear}
          className="mt-1.5 text-xs font-semibold text-violet-700/80 dark:text-violet-400/80"
        >
          Alle entfernen
        </button>
      )}
    </div>
  );
}
