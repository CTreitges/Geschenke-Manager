import type { ReactNode } from "react";
import { Icon } from "./icons";

// ── Page Header (sticky) ───────────────────────────────────────
export function PageHeader({ onBack, title, subtitle, right }: { onBack?: () => void; title?: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div
      className="sticky top-14 z-20 px-4 pt-3 pb-3.5"
      style={{
        background:
          "linear-gradient(to bottom, var(--gm-bg) 80%, transparent)",
      }}
    >
      <div className="flex items-center gap-2 min-h-9">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Zurück"
            title="Zurück"
            className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full w-9 h-9 flex items-center justify-center shrink-0 text-stone-900 dark:text-stone-50"
          >
            <Icon.back />
          </button>
        )}
        <div className="flex-1 min-w-0">
          {title && (
            <h1 className="m-0 text-[22px] font-bold text-stone-900 dark:text-stone-50 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
              {title}
            </h1>
          )}
          {subtitle && <div className="text-[13px] text-stone-500 dark:text-stone-400 mt-0.5 font-medium">{subtitle}</div>}
        </div>
        {right}
      </div>
    </div>
  );
}
