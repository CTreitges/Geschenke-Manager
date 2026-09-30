import { useState } from "react";
import { useRequireIdentity } from "@/components/IdentitySheet";
import { Button, Input } from "@/components/ui";
import { parsePrice } from "@/lib/money";
import { PollLockedError } from "@/lib/pollOps";
import { addSuggestion } from "@/lib/storage";
import { toast } from "sonner";

// ── Suggestion adder with optional link + price ──────────────
export function SuggestionAdder({
  giftId,
  recipientId,
  myId,
}: {
  giftId: string;
  recipientId: string;
  myId: string | null;
}) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [showExtra, setShowExtra] = useState(false);
  const requireIdentity = useRequireIdentity();

  async function add() {
    if (!text.trim()) return;
    // Ohne Identität erst fragen – danach wird die Idee gespeichert.
    const author = myId ?? (await requireIdentity({ recipientId, reason: "Damit deine Idee dir zugeordnet wird." }));
    if (!author) return;
    // Felder sofort leeren (die Idee erscheint gleich in der Liste, kein
    // Erfolgs-Toast); scheitert das Speichern, kommt der Text zurück.
    const draft = { text, url, price };
    addSuggestion({
      giftId,
      title: text.trim(),
      url: url.trim() || undefined,
      price: parsePrice(price),
      suggestedBy: author,
    }).catch((e) => {
      setText(draft.text);
      setUrl(draft.url);
      setPrice(draft.price);
      toast.error(e instanceof PollLockedError ? e.message : "Idee nicht gespeichert – bitte nochmal");
    });
    setText("");
    setUrl("");
    setPrice("");
    setShowExtra(false);
  }

  return (
    <div className="mt-2 rounded-xl border border-line-subtle bg-surface-2/60 p-2.5">
      <div className="flex items-center gap-2">
        <span className="text-base pl-1 shrink-0">💡</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
          placeholder="Idee teilen…"
          className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-fg outline-none placeholder:text-fg-muted"
        />
        <Button
          size="sm"
          onClick={() => void add()}
          disabled={!text.trim()}
          className="shrink-0"
          style={{ minHeight: 32, padding: "6px 12px" }}
        >
          Teilen
        </Button>
      </div>
      {!showExtra && text && (
        <button
          onClick={() => setShowExtra(true)}
          className="mt-1 block min-h-9 w-full pl-7 text-left text-xs font-semibold text-accent-text"
        >
          + Link / Preis
        </button>
      )}
      {showExtra && (
        <div className="flex gap-2 mt-2 pl-7">
          <Input
            placeholder="Link (optional)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-[2] py-2"
          />
          <Input
            placeholder="€"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="flex-1 py-2"
          />
        </div>
      )}
    </div>
  );
}
