import { Lock } from "lucide-react";
import { toast } from "sonner";
import { useRequireIdentity } from "@/components/IdentitySheet";
import { Section } from "@/components/ui";
import { PollLockedError } from "@/lib/pollOps";
import { addSuggestion } from "@/lib/storage";
import type { Gift, Person, Suggestion, WishlistItem } from "@/lib/types";
import { WishlistRow } from "./WishlistRow";

// ── Wunschliste der Person (mit Übernehmen) ───────────────────
// `blockedReason` gesetzt → Übernehmen gesperrt (laufende Abstimmung);
// Lesen bleibt erlaubt. Ohne Identität fragt das IdentitySheet zuerst.
export function WishlistAdoptSection({
  gift,
  person,
  personWishes,
  giftSuggestions,
  myId,
  blockedReason,
}: {
  gift: Gift;
  person: Person;
  personWishes: WishlistItem[];
  giftSuggestions: readonly Suggestion[];
  myId: string | null;
  blockedReason: string | null;
}) {
  const requireIdentity = useRequireIdentity();

  async function adopt(w: WishlistItem) {
    if (blockedReason) return;
    // Nur mit Identität – sonst stünde die beschenkte Person als Autorin da (B21).
    const author =
      myId ?? (await requireIdentity({ recipientId: gift.personId, reason: "Damit die Übernahme dir zugeordnet wird." }));
    if (!author) return;
    addSuggestion({
      giftId: gift.id,
      title: w.title,
      url: w.url,
      price: w.price,
      suggestedBy: author,
      fromWishItemId: w.id,
    })
      .then(() => toast.success("In die Ideen übernommen"))
      .catch((e) => toast.error(e instanceof PollLockedError ? e.message : "Übernehmen hat nicht geklappt – bitte nochmal"));
  }

  return (
    <Section
      title={`Wunschliste von ${person.name}`}
      count={personWishes.length || undefined}
      hint={blockedReason && personWishes.length > 0 ? "🔒 pausiert" : undefined}
    >
      {personWishes.length === 0 ? (
        <div className="rounded-card border border-line-subtle bg-surface-2 px-3.5 py-3 text-meta text-fg-soft">
          Noch keine Wünsche von {person.name}. Wenn {person.name} sich was wünscht, taucht es hier auf – und ihr könnt
          es mit einem Tipp in die Ideen übernehmen.
        </div>
      ) : (
        <>
          {blockedReason && (
            <p className="m-0 mb-2 flex items-center gap-1.5 text-meta text-fg-muted">
              <Lock size={14} aria-hidden className="shrink-0" />
              {blockedReason}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {personWishes.map((w) => (
              <WishlistRow
                key={w.id}
                wish={w}
                taken={giftSuggestions.some((s) => s.fromWishItemId === w.id)}
                disabled={!!blockedReason}
                onAdopt={() => void adopt(w)}
              />
            ))}
          </div>
        </>
      )}
    </Section>
  );
}
