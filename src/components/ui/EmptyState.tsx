import type { ReactNode } from "react";

// ── Empty State ────────────────────────────────────────────────
export function EmptyState({ emoji, title, subtitle, action }: { emoji: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="px-6 py-10 text-center flex flex-col items-center gap-2">
      <div className="text-[44px] mb-1.5">{emoji}</div>
      <div className="text-[15px] font-bold text-stone-900 dark:text-stone-50">{title}</div>
      {subtitle && <div className="text-[13px] text-stone-500 dark:text-stone-400 max-w-[260px] leading-[1.5]">{subtitle}</div>}
      {action && <div className="mt-2.5">{action}</div>}
    </div>
  );
}
