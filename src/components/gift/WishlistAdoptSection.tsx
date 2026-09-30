import { addSuggestion } from "@/lib/storage";
import { toast } from "sonner";
import type { Gift, Person, Suggestion, WishlistItem } from "@/lib/types";
import { Section } from "./Section";
import { WishlistRow } from "./WishlistRow";

// ── Wunschliste der Person (mit Übernehmen) ───────────────────
export function WishlistAdoptSection({
  gift,
  person,
  personWishes,
  giftSuggestions,
  myId,
}: {
  gift: Gift;
  person: Person;
  personWishes: WishlistItem[];
  giftSuggestions: Suggestion[];
  myId: string | null;
}) {
  const giftId = gift.id;

  return (
    <Section
      title={`Wunschliste von ${person.name}`}
      hint={personWishes.length > 0 ? `${personWishes.length}` : undefined}
    >
      {personWishes.length === 0 ? (
        <div className="text-[13px] text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/50 rounded-xl px-3.5 py-3 border border-[#F0EBE6] dark:border-[#3A3633]">
          Noch keine Wünsche von {person.name}. Wenn {person.name} sich was wünscht, taucht es hier
          auf — und ihr könnt es mit einem Tipp in die Vorschläge übernehmen.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {personWishes.map((w) => (
            <WishlistRow
              key={w.id}
              wish={w}
              taken={giftSuggestions.some((s) => s.fromWishItemId === w.id)}
              onAdopt={() => {
                addSuggestion({
                  giftId,
                  title: w.title,
                  url: w.url,
                  price: w.price,
                  suggestedBy: myId ?? gift.personId,
                  fromWishItemId: w.id,
                });
                toast.success("In Vorschläge übernommen");
              }}
            />
          ))}
        </div>
      )}
    </Section>
  );
}
