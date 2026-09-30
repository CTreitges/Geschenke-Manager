import { useNavigate } from "react-router-dom";
import { useIdentityPrompt } from "@/components/IdentitySheet";
import { Button, Confetti, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/hooks";
import { surpriseOccasion, type SurprisePhase } from "@/lib/spoiler";
import type { Gift, Person } from "@/lib/types";

// ── Überraschungs-Ansicht für die beschenkte Person ───────────
// planning: keine Ideen, Stimmen, Preise, Teilnehmer oder Bezahler – nur
// der Hinweis und die Wunschliste als sinnvolle Handlung. handedOver: nur
// die Titel der ausgewählten Ideen. Kein „Trotzdem ansehen“; der Ausweg ist
// ein bewusster Identitätswechsel (Trust-Prinzip).
export function SurpriseScreen({
  gift,
  person,
  phase,
  onBack,
}: {
  gift: Gift;
  person: Person;
  phase: Exclude<SurprisePhase, "none">;
  onBack: () => void;
}) {
  const { wishlist, suggestions } = useStore();
  const nav = useNavigate();
  const identity = useIdentityPrompt();
  const wishCount = wishlist.filter((w) => w.personId === person.id).length;
  const handedOver = phase === "handedOver";
  const selectedIds = gift.selectedSuggestionIds ?? [];
  const selectedTitles = handedOver
    ? suggestions.filter((s) => s.giftId === gift.id && selectedIds.includes(s.id)).map((s) => s.title)
    : [];

  return (
    <div>
      <PageHeader onBack={onBack} title={handedOver ? "Dein Geschenk" : "Deine Überraschung"} />
      <div className="px-4 pb-24">
        <section
          aria-label={handedOver ? "Überreicht" : "Überraschung"}
          className="relative overflow-hidden rounded-card bg-grad-hero p-5 text-white shadow-primary"
        >
          <Confetti active={handedOver} />
          <div aria-hidden className="text-4xl">
            {handedOver ? "🎉" : "🤫 🎁"}
          </div>
          {handedOver ? (
            <>
              <h2 className="m-0 mt-2 text-title font-extrabold">Dein Geschenk wurde überreicht</h2>
              {selectedTitles.length > 0 ? (
                <>
                  <p className="m-0 mt-2 text-body opacity-95">Das haben dir deine Freunde geschenkt:</p>
                  <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
                    {selectedTitles.map((t) => (
                      <li key={t} className="rounded-tile bg-white/15 px-3 py-2 text-body font-semibold">
                        🎁 {t}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="m-0 mt-2 text-body opacity-95">Schön, dass es geklappt hat!</p>
              )}
            </>
          ) : (
            <>
              <h2 className="m-0 mt-2 text-title font-extrabold">Psst … hier entsteht eine Überraschung!</h2>
              <p className="m-0 mt-2 text-body opacity-95">
                Deine Freunde planen etwas für {surpriseOccasion(gift.occasion)}. Ideen, Stimmen und Preise siehst du deshalb
                nicht.
              </p>
            </>
          )}
        </section>

        <p className="m-0 mt-4 text-body text-fg-soft">
          {handedOver ? "Für das nächste Mal hilft deine Wunschliste." : "Am meisten hilfst du mit deiner Wunschliste."}{" "}
          {wishCount > 0
            ? `✨ ${wishCount} ${wishCount === 1 ? "Wunsch" : "Wünsche"} eingetragen.`
            : "Noch keine Wünsche – leg los!"}
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <Button size="lg" className="w-full" onClick={() => nav("/wishlist")}>
            Wunschliste öffnen
          </Button>
          <Button variant="secondary" size="lg" className="w-full" onClick={() => nav("/")}>
            Zur Übersicht
          </Button>
        </div>
        <button
          type="button"
          onClick={() => void identity.open()}
          aria-haspopup="dialog"
          className="mt-3 flex min-h-tap w-full items-center justify-center text-meta text-fg-muted underline underline-offset-2"
        >
          Du bist nicht {person.name}? Identität wechseln
        </button>
      </div>
    </div>
  );
}
