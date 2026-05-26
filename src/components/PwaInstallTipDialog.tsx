import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button, Dialog } from "./ui";
import { isAuthed } from "@/lib/auth";
import {
  getCachedInstallPrompt,
  isStandalonePWA,
  onInstallPromptChange,
  tryInstallPwa,
  wasPwaInstalledEver,
} from "@/lib/pwa";

const TIP_KEY = "gm:pwa-install-tip-seen:v1";
const TUTORIAL_KEY = "gm:tutorial-seen:v5";
const TIP_CLOSED_EVENT = "gm:pwa-install-tip-closed";

type Platform = "chromium-prompt" | "chromium-manual" | "ios" | "firefox" | "other";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  const isFirefox = /Firefox|FxiOS/i.test(ua);
  if (isFirefox) return "firefox";
  if (getCachedInstallPrompt()) return "chromium-prompt";
  return "chromium-manual";
}

/**
 * One-time follow-up after the first-run tutorial. Walks the user through
 * installing the PWA with platform-specific instructions. Sets a flag so
 * it never shows again on this device.
 */
export function PwaInstallTipDialog() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [installing, setInstalling] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    if (
      loc.pathname === "/tutorial" ||
      loc.pathname.startsWith("/login") ||
      loc.pathname.startsWith("/m/")
    )
      return;
    if ((loc.state as Record<string, unknown>)?.fromShareLink) return;
    if (!isAuthed()) return;
    if (localStorage.getItem(TIP_KEY) === "yes") return;
    if (localStorage.getItem(TUTORIAL_KEY) !== "yes") return;
    if (isStandalonePWA() || wasPwaInstalledEver()) {
      localStorage.setItem(TIP_KEY, "yes");
      window.dispatchEvent(new Event(TIP_CLOSED_EVENT));
      return;
    }
    setPlatform(detectPlatform());
    setOpen(true);
  }, [loc.pathname]);

  // Re-evaluate the platform if Chrome fires the install prompt event after
  // we've already opened the dialog (or right when it opens). Switches the
  // dialog from "manual instructions" to "one-tap install button".
  useEffect(() => {
    if (!open) return;
    return onInstallPromptChange(() => {
      if (getCachedInstallPrompt()) setPlatform(detectPlatform());
    });
  }, [open]);

  function close() {
    localStorage.setItem(TIP_KEY, "yes");
    setOpen(false);
    window.dispatchEvent(new Event(TIP_CLOSED_EVENT));
  }

  async function install() {
    setInstalling(true);
    try {
      const outcome = await tryInstallPwa();
      if (outcome === "accepted") {
        localStorage.setItem(TIP_KEY, "yes");
        setOpen(false);
        window.dispatchEvent(new Event(TIP_CLOSED_EVENT));
      }
    } finally {
      setInstalling(false);
    }
  }

  return (
    <Dialog open={open} onClose={close} title="📲 App auf den Startbildschirm">
      <div className="space-y-3 text-[15px] leading-snug text-stone-700 dark:text-stone-200 px-5 pb-2">
        <p>
          Wenn du die App <strong>installierst</strong>, hast du ein eigenes
          Icon, einen sauberen Vollbild-Modus ohne Browser-Leiste — und{" "}
          <strong>Push-Benachrichtigungen</strong> aufs Handy, sobald jemand in
          den 30-Tage-Stack rutscht.
        </p>

        {platform === "chromium-prompt" && (
          <div className="rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900 px-3 py-2.5 text-[13px]">
            <p className="font-semibold text-violet-700 dark:text-violet-300 mb-1">
              Dein Browser kann es direkt:
            </p>
            <p>
              Tipp unten auf <strong>„Jetzt installieren"</strong> — der Browser
              fragt dich einmal nach, dann ist die App drauf.
            </p>
          </div>
        )}

        {platform === "chromium-manual" && (
          <div className="rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900 px-3 py-2.5 text-[13px] space-y-1">
            <p className="font-semibold text-violet-700 dark:text-violet-300">
              So geht's in Chrome / Edge:
            </p>
            <ul className="list-disc list-inside space-y-0.5 marker:text-violet-400">
              <li>
                <strong>Android:</strong> Menü (⋮) oben rechts → <em>„App
                installieren"</em> bzw. <em>„Zum Startbildschirm hinzufügen"</em>
              </li>
              <li>
                <strong>Desktop:</strong> Icon mit Bildschirm + Pfeil rechts in
                der Adressleiste — oder Menü (⋮) → <em>„App installieren"</em>
              </li>
            </ul>
            <p className="text-stone-500 dark:text-stone-400 text-[12px] pt-0.5">
              Findest du nichts? Dann ist die App vermutlich schon installiert.
            </p>
          </div>
        )}

        {platform === "ios" && (
          <div className="rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900 px-3 py-2.5 text-[13px] space-y-1">
            <p className="font-semibold text-violet-700 dark:text-violet-300">
              So geht's auf iPhone / iPad:
            </p>
            <ol className="list-decimal list-inside space-y-0.5 marker:text-violet-400">
              <li>
                Diese Seite in <strong>Safari</strong> öffnen (nicht Chrome —
                Apple lässt Install nur über Safari)
              </li>
              <li>
                Unten in der Symbolleiste auf das <strong>Teilen-Symbol</strong>{" "}
                (Quadrat mit Pfeil nach oben)
              </li>
              <li>
                <strong>„Zum Home-Bildschirm"</strong> wählen und{" "}
                <em>„Hinzufügen"</em>
              </li>
            </ol>
          </div>
        )}

        {platform === "firefox" && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-2.5 text-[13px] space-y-1">
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              Firefox unterstützt das nur eingeschränkt.
            </p>
            <p>
              Auf <strong>Android</strong> geht's über Menü (⋮) →{" "}
              <em>„Installieren"</em>. Auf <strong>Desktop</strong> bietet
              Firefox keinen App-Modus.
            </p>
            <p className="text-stone-600 dark:text-stone-300 pt-0.5">
              Beste Erfahrung: <strong>Chrome</strong> oder <strong>Edge</strong>{" "}
              (Android/Windows) bzw. <strong>Safari</strong> (iPhone/iPad).
            </p>
          </div>
        )}

        {platform === "other" && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-2.5 text-[13px]">
            Dein Browser unterstützt die Installation evtl. nicht. Öffne die
            Seite in <strong>Chrome</strong>, <strong>Edge</strong> oder{" "}
            <strong>Safari</strong> (iPhone/iPad) und folge dort dem
            Install-Prompt.
          </div>
        )}

        <p className="text-[13px] text-stone-500 dark:text-stone-400">
          Du findest diesen Hinweis später auch unter{" "}
          <strong>Einstellungen → App installieren</strong>.
        </p>
      </div>

      <div className="px-5 pb-2 pt-3 space-y-2">
        {platform === "chromium-prompt" && (
          <Button onClick={install} disabled={installing} className="w-full">
            {installing ? "…" : "📲 Jetzt installieren"}
          </Button>
        )}
        <Button
          onClick={close}
          variant={platform === "chromium-prompt" ? "secondary" : "primary"}
          className="w-full"
        >
          {platform === "chromium-prompt" ? "Später" : "Verstanden"}
        </Button>
      </div>
    </Dialog>
  );
}
