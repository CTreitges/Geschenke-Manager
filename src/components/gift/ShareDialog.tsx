import { useState } from "react";
import { Button, Dialog, Icon } from "@/components/ui";
import { getGroupId } from "@/lib/auth";
import { toast } from "sonner";

// ── Share-Dialog ──────────────────────────────────────────────
export function ShareDialog({
  open,
  onClose,
  giftId,
  personName,
}: {
  open: boolean;
  onClose: () => void;
  giftId: string;
  personName: string;
}) {
  const groupId = getGroupId();
  const shareUrl = groupId
    ? `${window.location.origin}/g/${groupId}/gift/${giftId}`
    : null;
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Clipboard nicht verfügbar");
    }
  }

  async function nativeShare() {
    if (!shareUrl) return;
    try {
      await navigator.share({
        title: `Geschenk für ${personName}`,
        text: "Schau dir das Geschenk an und mach mit!",
        url: shareUrl,
      });
    } catch {
      // user cancelled or not supported
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Geschenk teilen">
      <div className="space-y-4">
        <p className="text-[13px] text-stone-500 dark:text-stone-400 leading-[1.5]">
          Schick diesen Link an Personen, die beim Geschenk mitmachen sollen. Sie werden direkt
          zum Geschenk weitergeleitet — nach Login falls nötig.
        </p>
        {shareUrl ? (
          <>
            <div
              className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 cursor-pointer"
              onClick={copyLink}
            >
              <Icon.link size={14} className="text-stone-400 shrink-0" />
              <span className="flex-1 text-[13px] font-mono text-stone-600 dark:text-stone-300 truncate">
                {shareUrl}
              </span>
            </div>
            <Button onClick={copyLink} className="w-full" variant={copied ? "secondary" : "primary"}>
              {copied ? <><Icon.check size={16} /> Kopiert!</> : <><Icon.copy size={16} /> Link kopieren</>}
            </Button>
            {typeof navigator.share === "function" && (
              <Button onClick={nativeShare} variant="secondary" className="w-full">
                <Icon.share size={16} /> Teilen...
              </Button>
            )}
          </>
        ) : (
          <p className="text-[13px] text-red-500">Kein aktiver Gruppenkontext.</p>
        )}
      </div>
    </Dialog>
  );
}
