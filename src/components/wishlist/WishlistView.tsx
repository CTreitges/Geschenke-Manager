import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button, EmptyState, Icon, Overline, QuickAdd } from "@/components/ui";
import { useMyId, useStore } from "@/lib/hooks";
import { addWishItem, updateWishItem } from "@/lib/storage";
import type { Person, WishlistItem } from "@/lib/types";
import { addedByLabel, groupWishes, wishBadges } from "@/lib/wishlist";
import { WishItemCard } from "./WishItemCard";
import { WishSheet } from "./WishSheet";

type SheetState = { mode: "new" } | { mode: "edit"; id: string } | null;

// ── Wunschliste einer Person ──────────────────────────────────
// EINE Ansicht für „Meine Wunschliste“ (isOwner) und den Tab in der
// Personen-Seite. Spoiler-Schutz: Für die Besitzerin (und ohne Identität)
// gibt es kein „übernommen“ (wishBadges), „bekommen“ erst nach dem Erhalt.
export function WishlistView({ person, isOwner }: { person: Person; isOwner: boolean }) {
  const { wishlist, suggestions, gifts, persons } = useStore();
  const myId = useMyId();
  const nav = useNavigate();
  const [sheet, setSheet] = useState<SheetState>(null);

  const items = useMemo(() => wishlist.filter((w) => w.personId === person.id), [wishlist, person.id]);
  const groups = useMemo(() => groupWishes(items, Date.now()), [items]);
  const personsById = useMemo(() => Object.fromEntries(persons.map((p) => [p.id, p])), [persons]);
  const editWish = sheet?.mode === "edit" ? items.find((w) => w.id === sheet.id) : undefined;
  const openGift = isOwner ? undefined : gifts.find((g) => g.personId === person.id && g.status === "open");

  async function quickAdd(title: string) {
    try {
      const id = await addWishItem({ personId: person.id, title });
      toast.success("Wunsch hinzugefügt", {
        action: { label: "Details", onClick: () => setSheet({ mode: "edit", id }) },
      });
    } catch (e) {
      toast.error("Hinzufügen hat nicht geklappt – bitte nochmal");
      throw e; // Text bleibt im Feld stehen
    }
  }

  function update(w: WishlistItem, patch: Parameters<typeof updateWishItem>[1], done: string) {
    updateWishItem(w.id, patch)
      .then(() => toast.success(done))
      .catch(() => toast.error("Das hat nicht geklappt – bitte nochmal"));
  }

  function card(w: WishlistItem, footer?: ReactNode) {
    return (
      <WishItemCard
        key={w.id}
        wish={w}
        addedBy={addedByLabel(w, personsById, myId)}
        // Ohne Identität wie die Besitzerin: kein „übernommen“ (könnte sie selbst sein).
        badges={wishBadges(w, { isOwner: isOwner || !myId, suggestions, gifts })}
        onOpen={() => setSheet({ mode: "edit", id: w.id })}
        footer={footer}
      />
    );
  }

  const empty = items.length === 0;
  return (
    <div>
      <QuickAdd
        label={isOwner ? "Neuer Wunsch" : `Wunsch von ${person.name} notieren`}
        placeholder={isOwner ? "Was wünschst du dir?" : `Wunsch von ${person.name} notieren`}
        submitLabel="Wunsch hinzufügen"
        icon={<span className="text-lg">✨</span>}
        onAdd={quickAdd}
      />
      <button
        type="button"
        onClick={() => setSheet({ mode: "new" })}
        aria-haspopup="dialog"
        className="mt-1 flex min-h-tap items-center gap-1 pl-1 text-meta font-semibold text-accent-text"
      >
        Mit Link, Preis oder Notiz <Icon.chev />
      </button>

      {empty ? (
        isOwner ? (
          <EmptyState
            emoji="📝"
            title="Noch keine Wünsche – leg los!"
            subtitle="Tipp die ersten Ideen ein, deine Freunde sehen sie automatisch."
          />
        ) : (
          <EmptyState
            emoji="📝"
            title={`${person.name} hat noch nichts eingetragen`}
            subtitle={`Weißt du, was ${person.name} sich wünscht? Notier es hier – mit „notiert von …“.`}
            action={
              openGift ? (
                <Button variant="secondary" size="sm" onClick={() => nav(`/gift/${openGift.id}`)}>
                  Zum Geschenk
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="mt-2 flex flex-col gap-4">
          {groups.favorites.length > 0 && (
            <Group title="⭐ Herzenswünsche">{groups.favorites.map((w) => card(w))}</Group>
          )}
          {groups.rest.length > 0 && (
            <Group title={groups.favorites.length > 0 ? "Weitere Wünsche" : "Wünsche"}>
              {groups.rest.map((w) => card(w))}
            </Group>
          )}
          {groups.stale.length > 0 && (
            <Fold summary={`Älter als 12 Monate (${groups.stale.length}) – noch aktuell?`}>
              {groups.stale.map((w) =>
                card(
                  w,
                  <Button variant="secondary" size="sm" onClick={() => update(w, {}, "Bleibt auf der Liste ✓")}>
                    Noch aktuell ✓
                  </Button>,
                ),
              )}
            </Fold>
          )}
          {groups.fulfilled.length > 0 && (
            <Fold summary={`Bekommen (${groups.fulfilled.length})`}>
              {groups.fulfilled.map((w) =>
                card(
                  w,
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => update(w, { fulfilledAt: undefined, fulfilledGiftId: undefined }, "Wieder auf der Liste")}
                  >
                    Wieder auf die Liste
                  </Button>,
                ),
              )}
            </Fold>
          )}
        </div>
      )}

      <WishSheet
        open={sheet?.mode === "new" || !!editWish}
        onClose={() => setSheet(null)}
        person={person}
        isOwner={isOwner}
        wish={editWish ?? null}
      />
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <Overline className="mb-2 pl-1">{title}</Overline>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Fold({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="flex min-h-tap cursor-pointer list-none items-center gap-1.5 pl-1 text-meta font-semibold text-fg-soft [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="transition-transform group-open:rotate-90">
          <Icon.chev />
        </span>
        {summary}
      </summary>
      <div className="mt-1 flex flex-col gap-2">{children}</div>
    </details>
  );
}
