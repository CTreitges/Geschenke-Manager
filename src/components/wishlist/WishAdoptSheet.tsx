import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { useRequireIdentity } from "@/components/IdentitySheet";
import { Button, Icon, Sheet } from "@/components/ui";
import { useStore } from "@/lib/hooks";
import { adoptWish, deleteSuggestion } from "@/lib/storage";
import type { Gift, Person, WishlistItem } from "@/lib/types";
import { hostLabel, normalizeUrl } from "@/lib/url";
import { addedByLabel, sortWishes, wishBadges, wishStripSummary } from "@/lib/wishlist";
import { WishMeta } from "./WishItemCard";

/** Eigene deutsche Fehlertexte (Sperre, Identität) zeigen, Firebase-Fehler nicht. */
function errorText(e: unknown): string {
  return e instanceof Error && e.message && !("code" in e) ? e.message : "Übernehmen hat nicht geklappt – bitte nochmal";
}

// ── Wunschliste im Geschenk ───────────────────────────────────
// Amber Streifen in „Ideen“ → Übernahme-Sheet: Herzenswünsche zuerst,
// bekommene ausgeblendet. Während der Abstimmung (lockReason) lesbar, aber
// Übernehmen gesperrt. Nie für die beschenkte Person (GiftDetail zeigt ihr
// den SurpriseScreen, adoptWish verweigert zusätzlich).
export function GiftWishlist({
  gift,
  person,
  myId,
  lockReason,
}: {
  gift: Gift;
  person: Person;
  myId: string | null;
  lockReason: string | null;
}) {
  const { wishlist, suggestions } = useStore();
  const [open, setOpen] = useState(false);
  const wishes = useMemo(() => wishlist.filter((w) => w.personId === gift.personId), [wishlist, gift.personId]);
  const summary = wishStripSummary(wishes, suggestions, gift.id);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="mb-2.5 flex min-h-tap w-full items-center gap-3 rounded-card border border-wish/40 bg-wish-soft px-3.5 py-3 text-left"
      >
        <span aria-hidden className="text-lg leading-none">
          {lockReason ? "🔒" : "🎁"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-semibold leading-snug text-fg">Wunschliste von {person.name}</span>
          <span className="block text-xs font-medium text-wish-text">
            {lockReason ? `${summary} · während der Abstimmung gesperrt` : summary}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5 text-meta font-semibold text-wish-text">
          Ansehen <Icon.chev />
        </span>
      </button>
      <WishAdoptSheet
        open={open}
        onClose={() => setOpen(false)}
        gift={gift}
        person={person}
        wishes={wishes}
        myId={myId}
        lockReason={lockReason}
      />
    </>
  );
}

function WishAdoptSheet({
  open,
  onClose,
  gift,
  person,
  wishes,
  myId,
  lockReason,
}: {
  open: boolean;
  onClose: () => void;
  gift: Gift;
  person: Person;
  wishes: readonly WishlistItem[];
  myId: string | null;
  lockReason: string | null;
}) {
  const { suggestions, gifts, persons } = useStore();
  const requireIdentity = useRequireIdentity();
  const [busyId, setBusyId] = useState<string | null>(null);
  const personsById = useMemo(() => Object.fromEntries(persons.map((p) => [p.id, p])), [persons]);
  const otherGifts = useMemo(() => gifts.filter((g) => g.id !== gift.id), [gifts, gift.id]);
  const taken = new Set(suggestions.filter((s) => s.giftId === gift.id).map((s) => s.fromWishItemId));
  const list = sortWishes(wishes.filter((w) => !w.fulfilledAt));

  async function adopt(w: WishlistItem) {
    if (lockReason || busyId) return;
    // Nur mit Identität – sonst stünde niemand bzw. die beschenkte Person als Autorin da (B21).
    const by =
      myId ?? (await requireIdentity({ recipientId: gift.personId, reason: "Damit die Übernahme dir zugeordnet wird." }));
    if (!by) return;
    setBusyId(w.id);
    try {
      const { id, created } = await adoptWish(gift.id, w, by);
      if (created) {
        toast.success("Übernommen", {
          duration: 6000,
          action: {
            label: "Rückgängig",
            onClick: () => {
              deleteSuggestion(id).catch(() => toast.error("Rückgängig hat nicht geklappt"));
            },
          },
        });
      }
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Wunschliste von ${person.name}`}
      description={lockReason ?? "Übernimm Wünsche mit einem Tipp in die Ideen."}
    >
      {list.length === 0 ? (
        <p className="m-0 py-6 text-center text-meta text-fg-muted">{person.name} hat noch nichts eingetragen.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {list.map((w) => {
            const href = normalizeUrl(w.url);
            const host = hostLabel(w.url);
            return (
              <li key={w.id} className="flex items-start gap-2 border-b border-line-subtle py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <span className="flex items-start gap-1.5">
                    {w.favorite && (
                      <>
                        <Star size={15} aria-hidden className="mt-0.5 shrink-0 fill-wish text-wish" />
                        <span className="sr-only">Herzenswunsch:</span>
                      </>
                    )}
                    <span className="break-words text-body font-semibold leading-snug text-fg">{w.title}</span>
                  </span>
                  <WishMeta
                    wish={w}
                    addedBy={addedByLabel(w, personsById, myId)}
                    badges={wishBadges(w, { isOwner: false, suggestions, gifts: otherGifts })}
                  />
                </div>
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`„${w.title}“ ansehen${host ? ` (${host})` : ""}`}
                    title={host}
                    className="inline-flex min-h-tap min-w-tap shrink-0 items-center justify-center text-fg-muted hover:text-accent-text"
                  >
                    <Icon.link size={16} />
                  </a>
                )}
                {taken.has(w.id) ? (
                  <span className="mt-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-status-received-soft px-2.5 py-1 text-2xs font-semibold text-status-received">
                    <Icon.check size={12} /> übernommen
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-0.5 shrink-0"
                    disabled={!!lockReason}
                    loading={busyId === w.id}
                    aria-label={`„${w.title}“ übernehmen`}
                    onClick={() => void adopt(w)}
                  >
                    {lockReason && <Icon.lock size={14} />}
                    Übernehmen
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
