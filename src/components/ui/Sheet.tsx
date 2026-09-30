import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";

// ── Bottom-sheet Dialog ────────────────────────────────────────
// Rendered via portal into document.body so it is NEVER trapped inside
// an ancestor stacking context (e.g. the sticky header uses
// backdrop-blur, which scopes `position: fixed` to the header otherwise).
export function Dialog({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null;
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center animate-fadeIn">
      <div onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-stone-50 dark:bg-stone-900 rounded-t-[24px] flex flex-col max-h-[85vh] pb-[env(safe-area-inset-bottom,24px)] animate-slideUp"
      >
        <div className="pt-3 pb-2 flex justify-center">
          <div className="w-9 h-[5px] rounded-full bg-stone-300 dark:bg-stone-700" />
        </div>
        {title && (
          <div className="px-5 pb-3 pt-1 flex items-center justify-between">
            <h3 className="m-0 text-lg font-bold text-stone-900 dark:text-stone-50">{title}</h3>
            <button
              onClick={onClose}
              className="bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 w-8 h-8 rounded-full flex items-center justify-center"
            >
              <Icon.x />
            </button>
          </div>
        )}
        <div className="px-5 pb-4 flex-1 overflow-auto">{children}</div>
        {footer && <div className="px-5 pt-2.5 border-t border-stone-200 dark:border-stone-800">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
