import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// ── ItemRow: eine Zeile für Wünsche, Ideen, Listen ─────────────
type ItemRowProps = {
  title: ReactNode;
  /** Meta-Zeile unter dem Titel (Preis, Link, Autor, Datum …). */
  meta?: ReactNode;
  leading?: ReactNode;
  /** Aktionen/Status rechts; liegt außerhalb des klickbaren Bereichs. */
  trailing?: ReactNode;
  /** Macht Titel + Meta zu einem Button (kein klickbares div). */
  onClick?: () => void;
  className?: string;
};

export function ItemRow({ title, meta, leading, trailing, onClick, className }: ItemRowProps) {
  const body = (
    <>
      <div className="break-words text-sm font-semibold text-fg">{title}</div>
      {meta && <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">{meta}</div>}
    </>
  );
  return (
    <div className={cn("flex items-center gap-3 py-3", className)}>
      {leading && <div className="shrink-0">{leading}</div>}
      {onClick ? (
        <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
          {body}
        </button>
      ) : (
        <div className="min-w-0 flex-1">{body}</div>
      )}
      {trailing && <div className="flex shrink-0 items-center gap-1">{trailing}</div>}
    </div>
  );
}

// ── Skeleton: Platzhalter beim Laden ───────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-tile bg-surface-2", className)} />;
}
