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
        <p className="m-0 text-meta leading-normal text-fg-muted">
          Schick diesen Link an Personen, die beim Geschenk mitmachen sollen. Sie werden direkt
          zum Geschenk weitergeleitet — nach Login falls nötig.
        </p>
        {shareUrl ? (
          <>
            <button
              type="button"
              onClick={copyLink}
              aria-label={`Link kopieren: ${shareUrl}`}
              className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3.5 py-3 text-left"
            >
              <Icon.link size={14} className="shrink-0 text-fg-muted" />
              <span className="flex-1 truncate font-mono text-meta text-fg-soft">{shareUrl}</span>
            </button>
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
          <p className="m-0 text-meta text-danger">Kein aktiver Gruppenkontext.</p>
        )}
      </div>
    </Dialog>
  );
}
