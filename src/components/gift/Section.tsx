import type { ReactNode } from "react";

// ── Section wrapper ───────────────────────────────────────────
export function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="px-4 pb-4">
      <div className="flex items-center justify-between mb-2.5 pl-0.5 gap-2">
        <h3 className="m-0 text-[15px] font-bold text-stone-900 dark:text-stone-50 tracking-tight">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {hint && <span className="text-xs text-stone-400 font-medium">{hint}</span>}
          {action}
        </div>
      </div>
      {children}
    </div>
  );
}
