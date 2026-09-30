import { Check } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/cn";
import { setPaidBy } from "@/lib/storage";
import type { Person, Suggestion } from "@/lib/types";

/** „Wer hat bezahlt?“ als Avatar-Chips statt <select>; nochmal tippen entfernt. */
export function PayerChips({ suggestion: s, participants }: { suggestion: Suggestion; participants: readonly Person[] }) {
  if (participants.length === 0) {
    return <p className="m-0 text-meta text-fg-muted">Noch keine Teilnehmer eingetragen.</p>;
  }
  return (
    <div role="group" aria-label={`Wer hat „${s.title}“ bezahlt?`} className="flex flex-wrap gap-1.5">
      {participants.map((p) => {
        const on = s.paidBy === p.id;
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            onClick={() =>
              setPaidBy(s.id, on ? null : p.id).catch(() => toast.error("Bezahler nicht gespeichert – bitte nochmal"))
            }
            className={cn(
              "inline-flex min-h-tap items-center gap-1.5 rounded-full border pl-1 pr-3 text-meta font-semibold transition-colors",
              on ? "border-accent bg-accent-soft text-accent-text" : "border-line bg-surface text-fg-soft",
            )}
          >
            <Avatar person={p} size={26} />
            {p.name}
            {on && <Check size={14} strokeWidth={3} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
