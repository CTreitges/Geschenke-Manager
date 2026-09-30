import { useState } from "react";
import { Avatar, Icon, IconButton, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatEuro, parsePrice } from "@/lib/money";
import { hostLabel, normalizeUrl } from "@/lib/url";
import type { Person, Suggestion } from "@/lib/types";

// ── Idee als Karte (read-only oder mit ✎/✕) ────────────────────
// Abstimmen passiert im VoteSheet, Auswählen im Entscheidungs-Sheet – die
// Karte zeigt nur den Stand. Während der Abstimmung führt ein Tipp ins
// VoteSheet (`onOpen`), Bearbeiten/Löschen sind dann ausgeblendet.
export function SuggestionCard({
  suggestion: s,
  author,
  voters,
  winner,
  selected,
  editable,
  onOpen,
  onSave,
  onDelete,
}: {
  suggestion: Suggestion;
  author?: Person;
  /** Wähler (nur solange es eine Abstimmung gibt); undefined = keine Anzeige. */
  voters?: readonly Person[];
  winner: boolean;
  selected: boolean;
  editable: boolean;
  onOpen?: () => void;
  onSave: (patch: Partial<Suggestion>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(s.title);
  const [url, setUrl] = useState(s.url ?? "");
  const [price, setPrice] = useState(s.price != null ? String(s.price) : "");

  function startEdit() {
    setTitle(s.title);
    setUrl(s.url ?? "");
    setPrice(s.price != null ? String(s.price).replace(".", ",") : "");
    setEditing(true);
  }

  function save() {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSave({ title: trimmed, url: url.trim() || undefined, price: parsePrice(price) });
    setEditing(false);
  }

  const href = normalizeUrl(s.url);
  const host = hostLabel(s.url);
  const body = (
    <>
      <span className="block break-words text-body font-bold leading-tight text-fg">{s.title}</span>
      <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-fg-muted">
        {s.price != null && <span className="font-semibold text-accent-text">{formatEuro(s.price)}</span>}
        <span>von {author?.name ?? "?"}</span>
        {s.fromWishItemId && <span className="font-semibold text-status-vote">🎁 Wunschliste</span>}
      </span>
    </>
  );

  if (editing) {
    return (
      <div className="space-y-2 rounded-card border border-line bg-surface p-3.5">
        <Input placeholder="Titel" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus className="py-2 text-sm" />
        <div className="flex gap-2">
          <Input placeholder="Link (optional)" value={url} onChange={(e) => setUrl(e.target.value)} className="flex-[2] py-2 text-meta" />
          <Input
            placeholder="€"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="flex-1 py-2 text-meta"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={() => setEditing(false)} className="min-h-10 rounded-btn px-3 text-xs font-semibold text-fg-soft">
            Abbrechen
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!title.trim()}
            className="min-h-10 rounded-btn px-3 text-xs font-semibold text-accent-text disabled:opacity-50"
          >
            Speichern
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative rounded-card border bg-surface px-3.5 py-3",
        winner ? "border-2 border-accent" : selected ? "border-accent/60" : "border-line-subtle",
      )}
    >
      {winner && (
        <span className="absolute -top-2.5 right-3 rounded-full bg-grad-primary px-2.5 py-0.5 text-2xs font-bold text-white shadow-primary">
          🏆 Vorn
        </span>
      )}
      <div className="flex items-start gap-1">
        {onOpen ? (
          <button type="button" onClick={onOpen} className="min-w-0 flex-1 py-0.5 text-left" aria-label={`${s.title} – zur Abstimmung`}>
            {body}
          </button>
        ) : (
          <div className="min-w-0 flex-1 py-0.5">{body}</div>
        )}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`„${s.title}“ ansehen${host ? ` (${host})` : ""}`}
            title={host}
            className="inline-flex min-h-tap min-w-tap shrink-0 items-center justify-center text-fg-muted hover:text-accent-text"
          >
            <Icon.link size={16} />
          </a>
        )}
        {editable && (
          <>
            <IconButton label="Bearbeiten" size="sm" onClick={startEdit}>
              <Icon.pencil />
            </IconButton>
            <IconButton label="Löschen" size="sm" tone="danger" onClick={onDelete}>
              <Icon.x size={16} />
            </IconButton>
          </>
        )}
      </div>

      {voters && voters.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line-subtle pt-2">
          <span aria-hidden className="flex">
            {voters.map((v, i) => (
              <span key={v.id} className={cn(i > 0 && "-ml-1.5")}>
                <Avatar person={v} size={20} ring />
              </span>
            ))}
          </span>
          <span className="text-xs font-medium text-fg-muted">
            {voters.map((v) => v.name).join(", ")} {voters.length === 1 ? "hat" : "haben"} gewählt
          </span>
        </div>
      )}

      {selected && (
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-status-done-soft px-2 py-0.5 text-2xs font-semibold text-status-done">
          ✓ Ausgewählt
        </span>
      )}
    </div>
  );
}
