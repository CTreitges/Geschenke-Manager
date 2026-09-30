import type { ReactNode } from "react";
import { IconButton } from "./Button";
import { Icon } from "./icons";

// ── Page Header (sticky) ───────────────────────────────────────
export function PageHeader({ onBack, title, subtitle, right }: { onBack?: () => void; title?: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="sticky top-14 z-20 bg-gradient-to-b from-canvas from-80% to-transparent px-4 pb-3.5 pt-3">
      <div className="flex min-h-9 items-center gap-1">
        {onBack && (
          <IconButton label="Zurück" variant="outline" onClick={onBack} className="-ml-1.5">
            <Icon.back />
          </IconButton>
        )}
        <div className="min-w-0 flex-1">
          {title && <h1 className="m-0 truncate text-title font-bold tracking-tight text-fg">{title}</h1>}
          {subtitle && <div className="mt-0.5 text-meta font-medium text-fg-muted">{subtitle}</div>}
        </div>
        {right}
      </div>
    </div>
  );
}
