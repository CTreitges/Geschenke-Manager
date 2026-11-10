import { useState } from "react";
import { Button, Icon, Input } from "@/components/ui";
import { updateGift } from "@/lib/storage";
import { toast } from "sonner";
import type { Gift } from "@/lib/types";

// ── WhatsApp / Chat-Link Section ──────────────────────────────
export function WhatsappLinkSection({ gift }: { gift: Gift }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(gift.whatsappLink ?? "");

  function save() {
    const trimmed = draft.trim();
    updateGift(gift.id, { whatsappLink: trimmed || undefined });
    setEditing(false);
    toast.success(trimmed ? "Gruppen-Link gespeichert" : "Gruppen-Link entfernt");
  }

  if (gift.whatsappLink && !editing) {
    return (
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 rounded-xl border border-status-received/30 bg-status-received-soft px-3.5 py-2.5">
          <span className="text-lg shrink-0">💬</span>
          <a
            href={gift.whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate text-sm font-semibold text-status-received"
          >
            Gruppen-Chat öffnen
          </a>
          <button
            onClick={() => {
              setDraft(gift.whatsappLink ?? "");
              setEditing(true);
            }}
            aria-label="Link bearbeiten"
            className="flex min-h-tap min-w-tap shrink-0 items-center justify-center text-status-received"
          >
            <Icon.pencil />
          </button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="px-4 pb-3">
        <div className="space-y-2 rounded-xl border border-line bg-surface px-3.5 py-3">
          <Input
            label="Gruppen-Link (z.B. WhatsApp-Einladung)"
            type="url"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://chat.whatsapp.com/..."
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)} className="flex-1">
              Abbrechen
            </Button>
            <Button onClick={save} className="flex-1">
              Speichern
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-3">
      <button
        onClick={() => setEditing(true)}
        className="w-full rounded-xl border border-dashed border-line-control px-3.5 py-2.5 text-left text-meta text-fg-muted hover:border-accent hover:text-accent-text"
      >
        💬 Gruppen-Link hinzufügen (WhatsApp o.ä.)
      </button>
    </div>
  );
}
