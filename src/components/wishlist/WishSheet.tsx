import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button, Input, Sheet, Switch } from "@/components/ui";
import { parsePrice } from "@/lib/money";
import { addWishItem, deleteWishItem, restoreWishItem, updateWishItem } from "@/lib/storage";
import type { Person, WishlistItem } from "@/lib/types";
import { hostLabel, normalizeUrl } from "@/lib/url";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Wessen Liste. */
  person: Person;
  isOwner: boolean;
  /** null = neuer Wunsch. */
  wish: WishlistItem | null;
};

// ── Wunsch anlegen/bearbeiten ─────────────────────────────────
// Was, Link (mit Host-Vorschau), Preis ca. („19,99“ ok), Notiz, Herzenswunsch.
// Löschen schließt das Sheet und bietet im Toast „Rückgängig“ an.
export function WishSheet({ open, onClose, person, isOwner, wish }: Props) {
  const title = wish ? "Wunsch bearbeiten" : isOwner ? "Neuer Wunsch" : `Wunsch für ${person.name} notieren`;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={
        isOwner
          ? undefined
          : `${person.name} sieht diesen Eintrag. Eigene Geschenkideen gehören in die Ideen des Geschenks.`
      }
    >
      <WishForm person={person} wish={wish} onDone={onClose} />
    </Sheet>
  );
}

function priceText(price: number | undefined): string {
  return price != null ? String(price).replace(".", ",") : "";
}

function WishForm({ person, wish, onDone }: { person: Person; wish: WishlistItem | null; onDone: () => void }) {
  const [title, setTitle] = useState(wish?.title ?? "");
  const [url, setUrl] = useState(wish?.url ?? "");
  const [price, setPrice] = useState(priceText(wish?.price));
  const [note, setNote] = useState(wish?.note ?? "");
  const [favorite, setFavorite] = useState(!!wish?.favorite);
  const [busy, setBusy] = useState(false);
  const favId = useId();
  const linkHintId = useId();
  const priceHintId = useId();

  const href = normalizeUrl(url);
  const host = hostLabel(url);
  const urlInvalid = url.trim() !== "" && !href;
  const parsedPrice = parsePrice(price);
  const priceInvalid = price.trim() !== "" && parsedPrice === undefined;
  const canSave = title.trim() !== "" && !urlInvalid && !priceInvalid && !busy;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    const fields = {
      title: title.trim(),
      url: href,
      price: parsedPrice,
      note: note.trim() || undefined,
      favorite: favorite || undefined,
    };
    setBusy(true);
    try {
      if (wish) await updateWishItem(wish.id, fields);
      else await addWishItem({ personId: person.id, ...fields });
    } catch {
      toast.error("Speichern hat nicht geklappt – bitte nochmal");
      setBusy(false);
      return;
    }
    toast.success(wish ? "Gespeichert" : "Wunsch hinzugefügt");
    onDone();
  }

  async function remove() {
    if (!wish) return;
    onDone();
    try {
      await deleteWishItem(wish.id);
    } catch {
      toast.error("Löschen hat nicht geklappt – bitte nochmal");
      return;
    }
    toast.success("Wunsch gelöscht", {
      duration: 6000,
      action: {
        label: "Rückgängig",
        onClick: () => {
          restoreWishItem(wish).catch(() => toast.error("Wiederherstellen hat nicht geklappt"));
        },
      },
    });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3.5 pb-1">
      <Input label="Was?" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!wish} required />
      <div>
        <Input
          label="Link"
          placeholder="https://…"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-invalid={urlInvalid || undefined}
          aria-describedby={url.trim() ? linkHintId : undefined}
        />
        {url.trim() !== "" && (
          <p id={linkHintId} className={urlInvalid ? "m-0 mt-1.5 pl-0.5 text-meta text-danger" : "m-0 mt-1.5 pl-0.5 text-meta text-fg-muted"}>
            {urlInvalid ? "Link nicht erkannt – bitte eine Webadresse eingeben." : `↗ ${host}`}
          </p>
        )}
      </div>
      <div>
        <Input
          label="Preis ca. (€)"
          placeholder="z. B. 19,99"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          aria-invalid={priceInvalid || undefined}
          aria-describedby={priceInvalid ? priceHintId : undefined}
        />
        {priceInvalid && (
          <p id={priceHintId} className="m-0 mt-1.5 pl-0.5 text-meta text-danger">
            Preis nicht erkannt – z. B. „19,99“.
          </p>
        )}
      </div>
      <Input
        label="Notiz"
        placeholder="Größe, Farbe, Variante …"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex items-center justify-between gap-3 rounded-btn bg-surface-2 py-1 pl-3.5 pr-2">
        <span id={favId} className="text-body font-semibold text-fg">
          ⭐ Herzenswunsch
        </span>
        <Switch checked={favorite} onChange={() => setFavorite((f) => !f)} aria-labelledby={favId} />
      </div>
      <div className="mt-1 flex gap-2.5">
        {wish && (
          <Button type="button" variant="danger" onClick={() => void remove()}>
            Löschen
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={!canSave} loading={busy}>
          {wish ? "Speichern" : "Hinzufügen"}
        </Button>
      </div>
    </form>
  );
}
