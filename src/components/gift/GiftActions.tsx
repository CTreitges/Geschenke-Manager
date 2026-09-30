import { useNavigate } from "react-router-dom";
import { Button, Icon } from "@/components/ui";
import { deleteGift, markConfirmed, markReceived, unconfirmGift } from "@/lib/storage";
import { toast } from "sonner";
import type { Gift, Person, Suggestion } from "@/lib/types";

// ── CTAs: bestätigen / erhalten / aufheben / löschen ──────────
// `onAskPayment` öffnet nach "Geschenk erhalten" den Bezahler-Dialog,
// wenn ausgewählten Vorschlägen noch ein Bezahler fehlt.
export function GiftActions({
  gift,
  person,
  giftSuggestions,
  selectedIds,
  onAskPayment,
}: {
  gift: Gift;
  person: Person;
  giftSuggestions: Suggestion[];
  selectedIds: string[];
  onAskPayment: () => void;
}) {
  const nav = useNavigate();

  return (
    <div className="px-4 pt-2 pb-2 space-y-2.5">
      {gift.status === "open" && selectedIds.length > 0 && (
        <Button
          size="lg"
          onClick={() => {
            markConfirmed(gift.id);
            toast.success("Auswahl bestätigt ✓");
          }}
          className="w-full"
        >
          <Icon.check /> Auswahl bestätigen
        </Button>
      )}
      {gift.status === "confirmed" && (
        <Button
          size="lg"
          onClick={() => {
            if (!confirm(`Geschenk für ${person.name} als erhalten markieren?`)) return;
            markReceived(gift.id);
            toast.success("Geschenk erhalten ✓");
            // Dialog nur öffnen, wenn ausgewählte Vorschläge noch keinen
            // Bezahler haben.
            const selected = giftSuggestions.filter((s) =>
              (gift.selectedSuggestionIds ?? []).includes(s.id),
            );
            const missing = selected.some((s) => !s.paidBy);
            if (missing) {
              onAskPayment();
            } else {
              nav("/");
            }
          }}
          className="w-full"
        >
          <Icon.check /> Geschenk erhalten
        </Button>
      )}
      {gift.status === "confirmed" && (
        <Button
          variant="secondary"
          onClick={() => {
            unconfirmGift(gift.id);
            toast.success("Bestätigung aufgehoben");
          }}
          className="w-full"
        >
          <Icon.x size={16} /> Bestätigung aufheben
        </Button>
      )}
      {gift.status === "open" && selectedIds.length === 0 && (
        <Button
          size="lg"
          variant="secondary"
          onClick={() => {
            if (!confirm(`Geschenk für ${person.name} als erhalten markieren?\n\nKein Vorschlag ausgewählt — die Bestätigung wird übersprungen.`)) return;
            markReceived(gift.id);
            toast.success("Geschenk erhalten ✓");
            nav("/");
          }}
          className="w-full"
        >
          <Icon.check /> Geschenk erhalten
        </Button>
      )}
      <Button
        variant="danger"
        onClick={() => {
          if (
            !confirm(
              `Geschenk komplett löschen?\n\nAlle ${giftSuggestions.length} Vorschläge und die Abstimmung gehen verloren.`,
            )
          )
            return;
          deleteGift(gift.id);
          toast.success("Geschenk gelöscht");
          nav("/");
        }}
        className="w-full"
      >
        <Icon.trash /> Geschenk löschen
      </Button>
    </div>
  );
}
