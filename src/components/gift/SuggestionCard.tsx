import { useState } from "react";
import { Avatar, Icon, Input } from "@/components/ui";
import type { GiftStatus, Suggestion, Poll, Person } from "@/lib/types";

// ── Suggestion card (with inline edit) ────────────────────────
export function SuggestionCard({
  suggestion: s,
  author,
  voters,
  personsById,
  pollStatus,
  myVote,
  myId,
  isWinner,
  isSelected,
  onToggleSelect,
  onVote,
  onSave,
  onDelete,
  giftStatus,
  participants,
  onSetPaidBy,
}: {
  suggestion: Suggestion;
  author?: Person;
  voters: string[];
  personsById: Record<string, Person>;
  pollStatus: Poll["status"] | "none";
  myVote: boolean;
  myId: string | null;
  isWinner: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onVote: () => void;
  onSave: (patch: Partial<Suggestion>) => void;
  onDelete: () => void;
  giftStatus: GiftStatus;
  participants: Person[];
  onSetPaidBy: (personId: string | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(s.title);
  const [url, setUrl] = useState(s.url ?? "");
  const [price, setPrice] = useState(s.price != null ? String(s.price) : "");

  function startEdit() {
    setTitle(s.title);
    setUrl(s.url ?? "");
    setPrice(s.price != null ? String(s.price) : "");
    setEditing(true);
  }

  function save() {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSave({
      title: trimmed,
      url: url.trim() || undefined,
      price: price ? +price : undefined,
    });
    setEditing(false);
  }

  return (
    <div
      className="px-3.5 py-3.5 rounded-2xl relative bg-white dark:bg-stone-800 border"
      style={{
        borderColor: isWinner ? "#7C3AED" : isSelected ? "#A78BFA" : undefined,
        borderWidth: isWinner || isSelected ? 2 : 1,
        borderStyle: "solid",
      }}
    >
      {isWinner && (
        <div
          className="absolute -top-2.5 right-3 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide text-white"
          style={{
            background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
            boxShadow: "0 4px 10px -2px rgba(124,58,237,0.5)",
          }}
        >
          🏆 Gewonnen
        </div>
      )}
      <div className="flex items-start gap-2.5">
        {/* Selection checkbox */}
        <button
          onClick={onToggleSelect}
          aria-label={isSelected ? "Auswahl aufheben" : "Auswählen"}
          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 text-white"
          style={{
            background: isSelected
              ? "linear-gradient(135deg, #4F46E5, #7C3AED)"
              : "transparent",
            border: isSelected ? "none" : "2px solid #D6D3D1",
          }}
        >
          {isSelected && <Icon.check size={14} />}
        </button>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <Input
                placeholder="Titel"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                className="py-2 text-[14px]"
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Link (optional)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-[2] py-2 text-[13px]"
                />
                <Input
                  placeholder="€"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="flex-1 py-2 text-[13px]"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs font-semibold text-stone-500 px-2 py-1.5 rounded-md"
                >
                  Abbrechen
                </button>
                <button
                  onClick={save}
                  disabled={!title.trim()}
                  className="text-xs font-semibold text-violet-700 dark:text-violet-300 px-2 py-1.5 rounded-md disabled:opacity-50"
                >
                  Speichern
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-[15px] font-bold text-stone-900 dark:text-stone-50 leading-tight">
                {s.title}
              </div>
              <div className="flex gap-2.5 mt-1.5 items-center text-xs flex-wrap">
                {s.price != null && (
                  <span className="text-violet-700 dark:text-violet-300 font-semibold">
                    {s.price} €
                  </span>
                )}
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-stone-500 flex items-center gap-1"
                  >
                    <Icon.link /> Link
                  </a>
                )}
                <span className="text-stone-400">von {author?.name ?? "?"}</span>
                {s.fromWishItemId && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                    🎁 Wunschzettel
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {!editing && (
          <>
            {pollStatus === "active" && myId && (
              <button
                onClick={onVote}
                aria-label={myVote ? "Deine Stimme — klick zum Ändern" : "Wählen"}
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white"
                style={{
                  border: myVote ? "none" : "2px solid #D6D3D1",
                  background: myVote
                    ? "linear-gradient(135deg, #4F46E5, #7C3AED)"
                    : "transparent",
                }}
              >
                {myVote && <Icon.check size={14} />}
              </button>
            )}
            <button
              onClick={startEdit}
              className="text-stone-300 hover:text-violet-600 p-1"
              aria-label="Bearbeiten"
              title="Bearbeiten"
            >
              <Icon.pencil />
            </button>
            <button
              onClick={onDelete}
              className="text-stone-300 hover:text-red-500 p-1"
              aria-label="Löschen"
              title="Löschen"
            >
              <Icon.x size={16} />
            </button>
          </>
        )}
      </div>

      {!editing && pollStatus !== "none" && voters.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-stone-100 dark:border-stone-700 flex items-center gap-1.5 flex-wrap">
          <div className="flex">
            {voters.map((vid, i) => (
              <div key={vid} style={{ marginLeft: i > 0 ? -6 : 0 }}>
                <Avatar person={personsById[vid]} size={20} ring />
              </div>
            ))}
          </div>
          <div className="text-xs text-stone-500 dark:text-stone-400 font-medium">
            {voters.map((v) => personsById[v]?.name).filter(Boolean).join(", ")}{" "}
            {voters.length === 1 ? "hat" : "haben"} gewählt
          </div>
        </div>
      )}

      {/* Selected-for-group badge — sichtbar für alle */}
      {!editing && isSelected && (
        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 dark:bg-violet-950 text-violet-800 dark:text-violet-300">
          ✓ Für Gesamtsumme ausgewählt
        </div>
      )}

      {/* PaidBy-Dropdown: schon im offenen Status verfügbar — wird nach
          "Geschenk erhalten" gefestigt. */}
      {!editing && isSelected && (
        <div className="mt-2.5 pt-2.5 border-t border-stone-100 dark:border-stone-700 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-stone-700 dark:text-stone-200 shrink-0">
              💶 Bezahlt von:
            </span>
            <select
              value={s.paidBy ?? ""}
              onChange={(e) => onSetPaidBy(e.target.value || undefined)}
              className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
            >
              <option value="">— wählen —</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {s.paidBy && personsById[s.paidBy] && (
              <Avatar person={personsById[s.paidBy]} size={22} />
            )}
          </div>
          {giftStatus === "open" && (
            <div className="text-[11px] text-amber-700 dark:text-amber-300/90 flex items-center gap-1">
              📝 vorläufig — wird nach Erhalten gefestigt
            </div>
          )}
        </div>
      )}
    </div>
  );
}
