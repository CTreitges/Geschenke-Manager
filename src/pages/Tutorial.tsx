import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button, Icon } from "@/components/ui";
import { PwaInstallTipDialog } from "@/components/PwaInstallTipDialog";
import { IllDefs } from "@/components/tutorial/primitives";
import { tutorialPages } from "@/components/tutorial/pages";
import { indexFromScroll, keyAction, pageAnnouncement, settleIndex } from "@/components/tutorial/pager";
import { useIdentity } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { useBack } from "@/lib/nav";
import { markInstallTipSeen, markTutorialSeen } from "@/lib/onboarding";
import { CURRENT_VERSION } from "@/lib/patchnotes";
import { getCachedInstallPrompt, isStandalonePWA, onInstallPromptChange, tryInstallPwa, wasPwaInstalledEver } from "@/lib/pwa";

type TutorialState = { firstRun?: boolean } | null;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Grafisches Tutorial: Pager mit CSS-Scroll-Snap (Swipe), Tastatur und
 * Punkten. Liegt außerhalb von Layout (kein Header, keine Tab-Bar).
 * Das Gesehen-Flag wird erst beim Verlassen gesetzt – auch bei Zurück-Geste.
 */
export default function Tutorial() {
  const nav = useNavigate();
  const location = useLocation();
  const back = useBack("/");
  const firstRun = (location.state as TutorialState)?.firstRun === true;
  const hasIdentity = !!useIdentity();
  // Beim Öffnen einmal festlegen, damit sich die Seitenzahl nicht mittendrin ändert.
  const [showInstall] = useState(() => !isStandalonePWA() && !wasPwaInstalledEver());
  const pages = useMemo(() => tutorialPages({ showInstall, hasIdentity }), [showInstall, hasIdentity]);
  const count = pages.length;
  const last = count - 1;

  const [index, setIndex] = useState(0);
  const [installOpen, setInstallOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const firstHeadingRef = useRef<HTMLHeadingElement>(null);
  const rafRef = useRef(0);
  const pendingRef = useRef<number | null>(null);

  // ── Verlassen: Flag setzen (genau einmal) ───────────────────
  const doneRef = useRef(false);
  const reachedInstallRef = useRef(false);
  const markDone = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    markTutorialSeen(CURRENT_VERSION);
    // Wer die Install-Seite gesehen hat, bekommt den Install-Tipp nicht noch einmal.
    if (reachedInstallRef.current) markInstallTipSeen();
  }, []);

  const leave = useCallback(() => {
    markDone();
    if (firstRun) nav("/", { replace: true, state: { fromTutorial: true } });
    else back();
  }, [markDone, firstRun, nav, back]);

  // Zurück-Geste/Unmount zählt als Verlassen. Verzögert geprüft, damit das
  // Test-Unmount von StrictMode (Entwicklung) das Flag nicht vorzeitig setzt.
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      setTimeout(() => {
        if (!mountedRef.current) markDone();
      }, 0);
    };
  }, [markDone]);

  useEffect(() => {
    if (pages[index]?.id === "install") reachedInstallRef.current = true;
  }, [index, pages]);

  // ── Blättern ────────────────────────────────────────────────
  const goTo = useCallback(
    (i: number) => {
      const el = scrollerRef.current;
      const target = Math.min(Math.max(i, 0), last);
      pendingRef.current = target;
      setIndex(target);
      el?.scrollTo({ left: target * el.clientWidth, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    },
    [last],
  );

  function onScroll() {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const next = settleIndex(indexFromScroll(el.scrollLeft, el.clientWidth, count), pendingRef.current);
      pendingRef.current = next.pending;
      setIndex(next.index);
    });
  }

  /** Wischt jemand selbst, gilt wieder die Scroll-Position. */
  function onUserScroll() {
    pendingRef.current = null;
  }

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Bei Größenänderung (Drehen) auf der aktuellen Seite bleiben.
  useEffect(() => {
    const onResize = () => {
      const el = scrollerRef.current;
      if (el) el.scrollTo({ left: index * el.clientWidth, behavior: "auto" });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [index]);

  useEffect(() => {
    firstHeadingRef.current?.focus({ preventScroll: true });
  }, []);

  // ── Tastatur ────────────────────────────────────────────────
  useEffect(() => {
    if (installOpen) return; // das Sheet bedient Esc/Tab selbst
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      // Enter auf Knöpfen/Links löst deren Klick aus – nicht doppelt beenden.
      if (e.key === "Enter" && target?.closest("button, a, input, textarea, select")) return;
      const action = keyAction(e.key, index, count);
      if (!action) return;
      e.preventDefault();
      if (action.kind === "goto") goTo(action.index);
      else leave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [installOpen, index, count, goTo, leave]);

  const current = pages[index] ?? pages[0];
  const isLast = index === last;

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden text-fg md:items-center md:justify-center"
      style={{ background: "radial-gradient(120% 60% at 50% 0%, rgb(var(--gm-glow)) 0%, rgb(var(--gm-canvas)) 60%)" }}
    >
      <IllDefs />
      <h1 className="sr-only">So funktioniert's</h1>
      <div className="flex min-h-0 w-full flex-1 flex-col md:my-8 md:max-h-[calc(100dvh-4rem)] md:max-w-md md:flex-none md:overflow-hidden md:rounded-sheet md:border md:border-line md:bg-canvas md:shadow-card">
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          onPointerDown={onUserScroll}
          onWheel={onUserScroll}
          role="region"
          aria-roledescription="Karussell"
          aria-label="Tutorial"
          className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {pages.map((p, i) => {
            const active = i === index;
            return (
              <section
                key={p.id}
                role="group"
                aria-roledescription="Seite"
                aria-label={`${i + 1} von ${count}`}
                data-active={active}
                className="flex w-full shrink-0 snap-start flex-col overflow-y-auto px-6 pt-6"
                {...(active ? {} : { inert: "" })}
              >
                {/* my-auto: mittig, solange Platz ist; sonst oben beginnend scrollbar.
                    pb-10 hebt den Block optisch leicht über die Mitte. */}
                <div className="my-auto flex flex-col items-center pb-10">
                  <div className="aspect-[4/3] max-h-[40dvh] w-full max-w-sm">
                    <p.Ill alt={p.alt} />
                  </div>
                  <h2
                    ref={i === 0 ? firstHeadingRef : undefined}
                    tabIndex={-1}
                    className="m-0 mt-6 text-balance text-center text-title font-extrabold tracking-tight text-fg outline-none"
                  >
                    {p.title}
                  </h2>
                  <p className="m-0 mt-3 max-w-xs text-balance text-center text-base text-fg-soft">{p.body}</p>
                  {p.id === "install" && <InstallAction onShowHowTo={() => setInstallOpen(true)} />}
                </div>
              </section>
            );
          })}
        </div>

        <p aria-live="polite" className="sr-only">
          {pageAnnouncement(index, count, current.title)}
        </p>

        <div className="px-6 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div className="mb-3 flex items-center justify-center gap-1">
            {pages.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Seite ${i + 1}: ${p.title}`}
                aria-current={i === index ? "step" : undefined}
                className="flex h-6 w-6 items-center justify-center rounded-full"
              >
                <span
                  aria-hidden
                  className={cn(
                    "block h-2 rounded-full motion-safe:transition-[width]",
                    i === index ? "w-5 bg-grad-primary" : "w-2 bg-line-control/50",
                  )}
                />
              </button>
            ))}
            <span aria-hidden className="ml-2 text-meta font-semibold tabular-nums text-fg-muted">
              {index + 1}/{count}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {!isLast && (
              <Button variant="ghost" size="lg" onClick={leave} className="text-fg-soft">
                Überspringen
              </Button>
            )}
            <Button size="lg" className="flex-1" onClick={() => (isLast ? leave() : goTo(index + 1))}>
              {isLast ? "Los geht's" : "Weiter"}
              {!isLast && <Icon.chev size={16} />}
            </Button>
          </div>
        </div>
      </div>

      <PwaInstallTipDialog open={installOpen} onClose={() => setInstallOpen(false)} />
    </div>
  );
}

/** Seite 6: direkt installieren (Chrome/Edge) oder die Anleitung öffnen. */
function InstallAction({ onShowHowTo }: { onShowHowTo: () => void }) {
  const [hasPrompt, setHasPrompt] = useState(() => !!getCachedInstallPrompt());
  const [installing, setInstalling] = useState(false);
  useEffect(() => onInstallPromptChange(() => setHasPrompt(!!getCachedInstallPrompt())), []);

  async function install() {
    setInstalling(true);
    try {
      const outcome = await tryInstallPwa();
      if (outcome === "accepted") toast.success("App installiert 🎉");
      else if (outcome === "unavailable") onShowHowTo();
    } finally {
      setInstalling(false);
    }
  }

  return hasPrompt ? (
    <Button variant="secondary" className="mt-5" onClick={install} loading={installing}>
      Jetzt installieren
    </Button>
  ) : (
    <Button variant="ghost" className="mt-4 text-accent-text" onClick={onShowHowTo}>
      So geht's
      <Icon.chev size={14} />
    </Button>
  );
}
