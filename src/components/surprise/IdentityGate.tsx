import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useIdentityPrompt } from "@/components/IdentitySheet";
import { Button, Card, PageHeader } from "@/components/ui";

// ── „Wer bist du?“ vor den Geschenk-Details ────────────────────
// Ohne Identität würde auch die beschenkte Person alles sehen (z. B. über
// den Geschenk-Link in der WhatsApp-Gruppe). Deshalb zuerst fragen – mit
// bewusstem Ausweg „nur ansehen“ (gilt für die Sitzung). Kein Geschenk-
// Inhalt, solange diese Seite steht.
export function IdentityGate({
  recipientId,
  received = false,
  onBack,
  onSkip,
}: {
  recipientId: string;
  /** Erhaltenes Geschenk: die beschenkte Person bleibt hier (Titel der Auswahl). */
  received?: boolean;
  onBack: () => void;
  onSkip: () => void;
}) {
  const { open } = useIdentityPrompt();
  const nav = useNavigate();

  const ask = useCallback(async () => {
    const result = await open({
      recipientId,
      reason: "Wir fragen, damit niemand aus Versehen seine eigene Überraschung sieht.",
      laterLabel: "Ich bin nicht dabei, nur ansehen",
    });
    if (result.kind === "later") onSkip();
    else if (result.kind === "picked" && result.personId === recipientId && !received) {
      toast("Psst, das ist deine Überraschung 🤫");
      nav("/wishlist", { replace: true });
    }
  }, [open, recipientId, received, onSkip, nav]);

  // Einmal von selbst fragen (Ref übersteht den StrictMode-Doppelaufruf).
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void ask();
  }, [ask]);

  return (
    <div>
      <PageHeader onBack={onBack} title="Geschenk" />
      <div className="px-4 pb-24">
        <Card className="p-5 text-center">
          <div aria-hidden className="mb-2 text-4xl">
            👋
          </div>
          <h2 className="m-0 text-lg font-bold text-fg">Kurz vorab: Wer bist du?</h2>
          <p className="m-0 mt-1.5 text-body text-fg-soft">
            Wir fragen, damit niemand aus Versehen seine eigene Überraschung sieht.
          </p>
          <Button size="lg" className="mt-4 w-full" aria-haspopup="dialog" onClick={() => void ask()}>
            Ich wähle mich aus
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={onSkip}>
            Ich bin nicht dabei, nur ansehen
          </Button>
        </Card>
      </div>
    </div>
  );
}
