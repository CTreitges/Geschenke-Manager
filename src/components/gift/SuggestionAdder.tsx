import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { addSuggestion } from "@/lib/storage";
import { toast } from "sonner";

// ── Suggestion adder with optional link + price ──────────────
export function SuggestionAdder({ giftId, myId }: { giftId: string; myId: string | null }) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [showExtra, setShowExtra] = useState(false);

  function add() {
    if (!text.trim()) return;
    if (!myId) {
      toast.error("Wähle erst in den Einstellungen, wer du bist");
      return;
    }
    addSuggestion({
      giftId,
      title: text.trim(),
      url: url.trim() || undefined,
      price: price ? +price : undefined,
      suggestedBy: myId,
    });
    setText("");
    setUrl("");
    setPrice("");
    setShowExtra(false);
    toast.success("Vorschlag hinzugefügt");
  }

  return (
    <div className="mt-2 p-2.5 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-[#F0EBE6] dark:border-[#3A3633]">
      <div className="flex items-center gap-2">
        <span className="text-base pl-1 shrink-0">💡</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Idee teilen…"
          className="flex-1 min-w-0 outline-none bg-transparent px-1 py-1.5 text-stone-900 dark:text-stone-50"
        />
        <Button
          size="sm"
          onClick={add}
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
          className="block w-full mt-1 py-1 pl-7 text-left text-[12px] font-semibold text-violet-700 dark:text-violet-400"
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
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="flex-1 py-2"
          />
        </div>
      )}
    </div>
  );
}
