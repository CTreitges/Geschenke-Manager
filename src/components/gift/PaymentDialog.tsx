import { Button, Sheet } from "@/components/ui";
import { formatEuro } from "@/lib/money";
import type { Person, Suggestion } from "@/lib/types";
import { PayerChips } from "./PayerChips";

// ── „Wer hat was bezahlt?“ (nach „Als erhalten markieren“) ──────
export function PaymentDialog({
  open,
  onClose,
  selectedSuggestions,
  participants,
}: {
  open: boolean;
  onClose: () => void;
  selectedSuggestions: Suggestion[];
  participants: Person[];
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="💶 Wer hat was bezahlt?"
      description="Tipp pro Idee an, wer bezahlt hat. Das geht auch später noch."
      footer={
        <Button size="lg" onClick={onClose} className="w-full">
          Fertig
        </Button>
      }
    >
      {selectedSuggestions.length === 0 ? (
        <p className="m-0 text-meta text-fg-muted">Keine ausgewählten Ideen.</p>
      ) : (
        <div className="space-y-3">
          {selectedSuggestions.map((s) => (
            <div key={s.id} className="space-y-2 rounded-card border border-line-subtle bg-surface p-3">
              <p className="m-0 text-sm font-semibold text-fg">
                {s.title}
                {s.price != null && <span className="ml-2 text-accent-text">· {formatEuro(s.price)}</span>}
              </p>
              <PayerChips suggestion={s} participants={participants} />
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
