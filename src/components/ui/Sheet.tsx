import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { IconButton } from "./Button";
import { Icon } from "./icons";
import { registerSheet } from "./sheetStack";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Bekommt beim Öffnen den Fokus. Sonst: ein per autoFocus fokussiertes Feld, sonst das Sheet selbst. */
  initialFocusRef?: RefObject<HTMLElement>;
  /** false = kein eigener History-Eintrag, weil der Offen-Zustand in der URL steht (Zurück schließt über den Router). */
  history?: boolean;
};

// ── Bottom-Sheet ───────────────────────────────────────────────
// Per Portal in document.body gerendert, damit es NIE in einem Stacking-
// Context eines Vorfahren hängt (der Sticky-Header nutzt backdrop-blur,
// das `position: fixed` sonst auf den Header begrenzt).
// Schließen: ✕, Backdrop, Esc, Android-Zurück (siehe sheetStack.ts).
export function Sheet({ open, ...rest }: SheetProps) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(<SheetPanel {...rest} />, document.body);
}

/** Kompatibler Alias: alle bisherigen Dialog-Aufrufer bekommen das Sheet. */
export const Dialog = Sheet;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapFocus(e: KeyboardEvent, panel: HTMLElement) {
  const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
  if (items.length === 0) {
    e.preventDefault();
    panel.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (!panel.contains(active)) {
    e.preventDefault();
    first.focus();
  } else if (e.shiftKey && (active === first || active === panel)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

function SheetPanel({ onClose, title, description, children, footer, initialFocusRef, history = true }: Omit<SheetProps, "open">) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Aufrufer übergeben meist eine Inline-Funktion → über Ref, damit die
  // Effekte nicht bei jedem Render neu laufen (History-Eintrag!).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Auslöser merken, bevor autoFocus im Sheet den Fokus verschiebt.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    const panel = panelRef.current;
    const handle = registerSheet(() => onCloseRef.current(), { history });

    const target = initialFocusRef?.current ?? (panel && !panel.contains(document.activeElement) ? panel : null);
    target?.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !handle.isTop()) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === "Tab" && panel) {
        trapFocus(e, panel);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      handle.release();
      // Fokus nur zurückgeben, wenn das Sheet wirklich weg ist. Beim Doppel-
      // Aufruf der Effekte (StrictMode, Entwicklung) hängt das Panel noch im
      // DOM – sonst verlöre ein autoFocus-Feld im Sheet seinen Fokus.
      if (!panel?.isConnected && opener?.isConnected) opener.focus({ preventScroll: true });
    };
    // Bewusst nur beim Öffnen/Schließen: Fokus und History-Eintrag gehören zum Mount.
  }, []);

  const safeBottom = "pb-[max(16px,env(safe-area-inset-bottom))]";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center animate-fadeIn">
      {/* design-ok: Backdrop – Klick schließt, per Tastatur über Esc bzw. ✕ */}
      <div aria-hidden onClick={() => onCloseRef.current()} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className="relative w-full max-w-2xl bg-canvas text-fg rounded-t-sheet flex flex-col max-h-[85dvh] outline-none animate-slideUp"
      >
        {title && (
          <div className="pl-5 pr-3 pt-3 pb-2 flex items-center justify-between gap-2">
            <h2 id={titleId} className="m-0 text-lg font-bold text-fg">
              {title}
            </h2>
            <IconButton label="Schließen" variant="soft" size="sm" onClick={() => onCloseRef.current()}>
              <Icon.x />
            </IconButton>
          </div>
        )}
        {description && (
          <p id={descId} className="m-0 px-5 pb-3 text-meta text-fg-muted">
            {description}
          </p>
        )}
        <div className={cn("px-5 flex-1 overflow-auto overscroll-contain", footer ? "pb-4" : safeBottom)}>{children}</div>
        {footer && <div className={cn("px-5 pt-2.5 border-t border-line", safeBottom)}>{footer}</div>}
      </div>
    </div>
  );
}
