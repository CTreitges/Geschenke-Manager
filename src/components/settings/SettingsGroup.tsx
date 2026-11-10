import type { ReactNode } from "react";
import { Card, Icon } from "@/components/ui";
import { cn } from "@/lib/cn";

// Bausteine der Einstellungen: Gruppe (Überschrift + Karte) und Zeile.
// Zeilen mit onClick sind echte Buttons mit Pfeil, alle anderen nicht.

export function SettingsGroup({ title, tone, children }: { title: ReactNode; tone?: "danger"; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h2
        className={cn(
          "m-0 px-3.5 pb-1.5 pt-1.5 text-2xs font-bold uppercase tracking-[.05em]",
          tone === "danger" ? "text-danger" : "text-fg-muted",
        )}
      >
        {title}
      </h2>
      <Card className={cn("overflow-hidden p-0", tone === "danger" && "border-danger/40")}>{children}</Card>
    </section>
  );
}

type RowProps = {
  label: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  /** Rechts: Wert, Schalter oder Knopf (nur ohne onClick). */
  children?: ReactNode;
  /** Ganze Zeile als Button (mit Pfeil). */
  onClick?: () => void;
  danger?: boolean;
  /** aria-haspopup, wenn die Zeile ein Sheet öffnet. */
  opensDialog?: boolean;
};

export function SettingsRow({ label, hint, icon, children, onClick, danger, opensDialog }: RowProps) {
  const body = (
    <>
      {icon && (
        <span
          aria-hidden
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-tile",
            danger ? "bg-danger-soft text-danger" : "bg-surface-2 text-fg-soft",
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-semibold", danger ? "text-danger" : "text-fg")}>{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-fg-muted">{hint}</span>}
      </span>
      {children}
      {onClick && <Icon.chev size={16} className="shrink-0 text-fg-muted" />}
    </>
  );
  const cls = "flex w-full items-center gap-3 border-t border-line-subtle px-3.5 py-3 text-left first:border-t-0";
  if (!onClick) return <div className={cls}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup={opensDialog ? "dialog" : undefined}
      className={cn(cls, "min-h-14 transition-colors hover:bg-surface-2/60")}
    >
      {body}
    </button>
  );
}
