import { Button, Dialog } from "@/components/ui";
import type { Suggestion, Person } from "@/lib/types";

// ── Payment-Dialog (nach Geschenk-erhalten) ───────────────────
export function PaymentDialog({
  open,
  onClose,
  selectedSuggestions,
  participants,
  onSetPaidBy,
}: {
  open: boolean;
  onClose: () => void;
  selectedSuggestions: Suggestion[];
  participants: Person[];
  onSetPaidBy: (suggestionId: string, personId: string | undefined) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="💶 Wer hat was bezahlt?">
      <div className="space-y-3 px-5 pb-2">
        <p className="text-[13px] text-stone-500 dark:text-stone-400 leading-snug">
          Trag pro Vorschlag ein, wer's bezahlt hat. Kannst du auch später noch anpassen.
        </p>
        {selectedSuggestions.length === 0 ? (
          <div className="text-[13px] text-stone-500 dark:text-stone-400 italic">
            Keine ausgewählten Vorschläge.
          </div>
        ) : (
          selectedSuggestions.map((s) => (
            <div
              key={s.id}
              className="px-3 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 space-y-2"
            >
              <div className="text-[14px] font-semibold text-stone-900 dark:text-stone-50">
                {s.title}
                {s.price != null && (
                  <span className="ml-2 text-violet-700 dark:text-violet-300">
                    · {s.price} €
                  </span>
                )}
              </div>
              <select
                value={s.paidBy ?? ""}
                onChange={(e) => onSetPaidBy(s.id, e.target.value || undefined)}
                className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
              >
                <option value="">— Bezahler wählen —</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          ))
        )}
        <div className="pt-2">
          <Button onClick={onClose} className="w-full">
            Fertig
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
