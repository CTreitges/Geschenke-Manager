import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Icon, IconButton, Sheet } from "./ui";
import { PwaInstallTipDialog } from "./PwaInstallTipDialog";
import { whenHistorySettled } from "./ui/sheetStack";
import { cn } from "@/lib/cn";
import { WHATS_NEW_EVENT, hasUnseenVersion } from "@/lib/onboarding";
import { CURRENT_DATE, CURRENT_VERSION, formatPatchDate } from "@/lib/patchnotes";
import { getCachedInstallPrompt, isStandalonePWA, onInstallPromptChange, tryInstallPwa, wasPwaInstalledEver } from "@/lib/pwa";

/** true, solange „Was ist neu“ für die aktuelle Version ungesehen ist. */
export function useUnseenVersion(): boolean {
  const [unseen, setUnseen] = useState(() => hasUnseenVersion(CURRENT_VERSION));
  useEffect(() => {
    const update = () => setUnseen(hasUnseenVersion(CURRENT_VERSION));
    window.addEventListener(WHATS_NEW_EVENT, update);
    return () => window.removeEventListener(WHATS_NEW_EVENT, update);
  }, []);
  return unseen;
}

/** Browser und nie installiert → „App installieren“ anbieten. */
function useCanInstall(): boolean {
  const [can, setCan] = useState(() => !isStandalonePWA() && !wasPwaInstalledEver());
  useEffect(() => onInstallPromptChange(() => setCan(!isStandalonePWA() && !wasPwaInstalledEver())), []);
  return can;
}

type EntryProps = {
  icon: ReactNode;
  title: string;
  hint?: string;
  badge?: ReactNode;
  primary?: boolean;
  onClick: () => void;
};

function Entry({ icon, title, hint, badge, primary = false, onClick }: EntryProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-card px-3 py-2.5 text-left transition-colors",
        primary ? "border border-accent/30 bg-accent-soft" : "hover:bg-surface-2",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-tile",
          primary ? "bg-grad-primary text-white shadow-primary" : "bg-surface-2 text-fg-soft",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-body font-semibold text-fg">
          {title}
          {badge}
        </span>
        {hint && <span className="mt-0.5 block text-meta text-fg-muted">{hint}</span>}
      </span>
      <Icon.chev size={16} className="shrink-0 text-fg-muted" />
    </button>
  );
}

function NewBadge() {
  return (
    <span className="rounded-full bg-grad-primary px-2 py-0.5 text-2xs font-bold uppercase tracking-wide text-white">neu</span>
  );
}

/**
 * Die Hilfe-Einträge in fester Reihenfolge: Tutorial zuerst, dann Was ist neu,
 * Häufige Fragen, Feedback und (optional) App installieren.
 * Genutzt im Hilfe-Sheet und in Einstellungen → Hilfe.
 */
export function HelpEntries({ go, onInstall }: { go: (to: string) => void; onInstall?: () => void }) {
  const unseen = useUnseenVersion();
  return (
    <div className="flex flex-col gap-1">
      <Entry
        primary
        icon={<Play size={18} fill="currentColor" />}
        title="Tutorial ansehen"
        hint="5 kurze Seiten · ca. 1 Minute"
        onClick={() => go("/tutorial")}
      />
      <Entry
        icon={<Sparkles size={18} />}
        title="Was ist neu"
        hint={`${CURRENT_VERSION} · ${formatPatchDate(CURRENT_DATE)}`}
        badge={unseen ? <NewBadge /> : undefined}
        onClick={() => go("/whats-new")}
      />
      <Entry icon={<Icon.help size={18} />} title="Häufige Fragen" hint="Gruppen, Mails, Abstimmen …" onClick={() => go("/help")} />
      <Entry icon={<Icon.mail size={18} />} title="Feedback geben" hint="Wünsche, Ideen, Fehler" onClick={() => go("/feedback")} />
      {onInstall && (
        <Entry icon={<Download size={18} />} title="App installieren" hint="Für Push-Nachrichten aufs Handy" onClick={onInstall} />
      )}
    </div>
  );
}

/**
 * „App installieren“ aus Hilfe-Sheet und Einstellungen: erst der native
 * Prompt, sonst die Anleitung (PwaInstallTipDialog, `guide` mitrendern).
 * `close` schließt vorher ein offenes Sheet (im selben Render wie das Öffnen
 * der Anleitung, damit die History-Einträge der Sheets sauber bleiben).
 */
export function useInstallApp() {
  const canInstall = useCanInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const install = useCallback(async (close?: () => void) => {
    if (getCachedInstallPrompt()) {
      const outcome = await tryInstallPwa();
      if (outcome === "accepted") {
        toast.success("App installiert 🎉");
        close?.();
        return;
      }
      if (outcome === "dismissed") return;
    }
    close?.();
    setGuideOpen(true);
  }, []);
  const guide = <PwaInstallTipDialog open={guideOpen} onClose={() => setGuideOpen(false)} />;
  return { canInstall, install, guide };
}

function buildLabel(): string {
  try {
    return new Date(__BUILD_TIME__).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** „?“ im Header: öffnet das Hilfe-Sheet, Neu-Punkt bei ungesehener Version. */
export function HelpMenu() {
  const nav = useNavigate();
  const unseen = useUnseenVersion();
  const { canInstall, install, guide } = useInstallApp();
  const [open, setOpen] = useState(false);
  const [pendingNav, setPendingNav] = useState<string | null>(null);

  // Erst navigieren, wenn das Sheet zu ist und sein History-Eintrag
  // abgeräumt wurde – sonst macht dessen history.back() die Navigation rückgängig.
  useEffect(() => {
    if (open || !pendingNav) return;
    const to = pendingNav;
    setPendingNav(null);
    void whenHistorySettled().then(() => nav(to));
  }, [open, pendingNav, nav]);

  function go(to: string) {
    setPendingNav(to);
    setOpen(false);
  }

  const build = buildLabel();
  return (
    <>
      <span className="relative -mx-1 inline-flex">
        <IconButton
          label={unseen ? `Hilfe – neu in ${CURRENT_VERSION}` : "Hilfe"}
          variant="outline"
          size="sm"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Icon.help size={18} />
        </IconButton>
        {unseen && (
          <span
            aria-hidden
            className="pointer-events-none absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-grad-primary ring-2 ring-canvas"
          />
        )}
      </span>

      <Sheet open={open} onClose={() => setOpen(false)} title="Hilfe">
        <HelpEntries go={go} onInstall={canInstall ? () => void install(() => setOpen(false)) : undefined} />
        <p className="m-0 mt-4 text-center text-2xs text-fg-muted">
          Geschenke-Manager · {CURRENT_VERSION}
          {build && ` · Build ${build}`}
        </p>
      </Sheet>

      {guide}
    </>
  );
}
