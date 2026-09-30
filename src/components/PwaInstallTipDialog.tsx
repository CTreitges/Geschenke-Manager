import { useEffect, useState } from "react";
import { Button, Dialog } from "./ui";
import { getCachedInstallPrompt, onInstallPromptChange, tryInstallPwa } from "@/lib/pwa";

type Platform = "chromium-prompt" | "chromium-manual" | "ios" | "firefox" | "other";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Firefox|FxiOS/i.test(ua)) return "firefox";
  if (getCachedInstallPrompt()) return "chromium-prompt";
  return "chromium-manual";
}

const BOX = "rounded-tile border px-3 py-2.5 text-meta";
const BOX_INFO = `${BOX} bg-accent-soft border-accent/30`;
const BOX_WARN = `${BOX} bg-status-vote-soft border-status-vote/30`;

/**
 * Anleitung „App auf den Startbildschirm“ – rein präsentational.
 * Wer den Dialog zeigt (OnboardingFlow, Hilfe-Menü, Tutorial-Seite 6),
 * entscheidet selbst, ob danach ein Flag gesetzt wird.
 */
export function PwaInstallTipDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [platform, setPlatform] = useState<Platform>("other");
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlatform(detectPlatform());
    // Chrome feuert das Install-Event manchmal erst nach dem Öffnen:
    // dann von „Anleitung“ auf „Ein-Tipp-Installation“ umschalten.
    return onInstallPromptChange(() => setPlatform(detectPlatform()));
  }, [open]);

  async function install() {
    setInstalling(true);
    try {
      if ((await tryInstallPwa()) === "accepted") onClose();
    } finally {
      setInstalling(false);
    }
  }

  const withPrompt = platform === "chromium-prompt";
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="App auf den Startbildschirm"
      footer={
        <div className="flex flex-col gap-2">
          {withPrompt && (
            <Button onClick={install} loading={installing} size="lg" className="w-full">
              Jetzt installieren
            </Button>
          )}
          <Button onClick={onClose} variant={withPrompt ? "secondary" : "primary"} size="lg" className="w-full">
            {withPrompt ? "Später" : "Verstanden"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-body text-fg-soft">
        <p>
          Installiert hat die App ein eigenes Symbol, startet ohne Browser-Leiste und kann dir{" "}
          <strong className="text-fg">Push-Nachrichten</strong> zu Geburtstagen und Abstimmungen schicken.
        </p>

        {withPrompt && (
          <div className={BOX_INFO}>
            <p className="font-semibold text-accent-text">Dein Browser kann es direkt.</p>
            <p>Tipp unten auf „Jetzt installieren“ – der Browser fragt einmal nach, dann ist die App drauf.</p>
          </div>
        )}

        {platform === "chromium-manual" && (
          <div className={`${BOX_INFO} space-y-1`}>
            <p className="font-semibold text-accent-text">So geht's in Chrome oder Edge:</p>
            <ul className="list-inside list-disc space-y-0.5">
              <li>
                <strong>Android:</strong> Menü (⋮) oben rechts → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“
              </li>
              <li>
                <strong>Computer:</strong> Symbol mit Bildschirm und Pfeil in der Adressleiste – oder Menü (⋮) → „App installieren“
              </li>
            </ul>
            <p className="text-xs text-fg-muted">Findest du nichts? Dann ist die App vermutlich schon installiert.</p>
          </div>
        )}

        {platform === "ios" && (
          <div className={`${BOX_INFO} space-y-1`}>
            <p className="font-semibold text-accent-text">So geht's auf iPhone und iPad:</p>
            <ol className="list-inside list-decimal space-y-0.5">
              <li>
                Diese Seite in <strong>Safari</strong> öffnen (Apple erlaubt das nur dort)
              </li>
              <li>
                Unten auf das <strong>Teilen-Symbol</strong> tippen (Quadrat mit Pfeil nach oben)
              </li>
              <li>
                <strong>„Zum Home-Bildschirm“</strong> wählen und „Hinzufügen“
              </li>
            </ol>
          </div>
        )}

        {platform === "firefox" && (
          <div className={`${BOX_WARN} space-y-1`}>
            <p className="font-semibold text-status-vote">Firefox kann das nur eingeschränkt.</p>
            <p>
              Auf <strong>Android</strong> über Menü (⋮) → „Installieren“. Am Computer bietet Firefox keinen App-Modus –
              nimm dafür Chrome, Edge oder auf dem iPhone Safari.
            </p>
          </div>
        )}

        {platform === "other" && (
          <div className={BOX_WARN}>
            Dein Browser kann die App vielleicht nicht installieren. Öffne die Seite in <strong>Chrome</strong>,{" "}
            <strong>Edge</strong> oder auf dem iPhone in <strong>Safari</strong>.
          </div>
        )}

        <p className="text-meta text-fg-muted">Diese Anleitung findest du jederzeit im Hilfe-Menü unter „?“ oben rechts.</p>
      </div>
    </Dialog>
  );
}
