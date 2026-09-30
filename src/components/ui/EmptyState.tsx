import type { ReactNode } from "react";

// ── Empty State ────────────────────────────────────────────────
export function EmptyState({ emoji, title, subtitle, action }: { emoji: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="px-6 py-10 text-center flex flex-col items-center gap-2">
      <div aria-hidden className="mb-1.5 text-5xl leading-none">
        {emoji}
      </div>
      <div className="text-body font-bold text-fg">{title}</div>
      {subtitle && <div className="max-w-[260px] text-meta leading-normal text-fg-muted">{subtitle}</div>}
      {action && <div className="mt-2.5">{action}</div>}
    </div>
  );
}
