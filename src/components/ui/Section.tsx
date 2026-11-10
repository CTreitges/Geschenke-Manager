import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// ── Section / SectionCard / Overline ───────────────────────────
// Einheitliche Abschnitts-Überschrift: h2, text-body fett, optionaler Zähler.

function SectionTitle({ id, title, count }: { id: string; title: ReactNode; count?: number }) {
  return (
    <h2 id={id} className="m-0 flex items-center gap-2 text-body font-bold tracking-tight text-fg">
      {title}
      {count !== undefined && (
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-semibold text-fg-soft">{count}</span>
      )}
    </h2>
  );
}

type SectionProps = {
  title: ReactNode;
  count?: number;
  /** Kurzer Hinweis rechts neben der Überschrift. */
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Section({ title, count, hint, action, children, className }: SectionProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("px-4 pb-4", className)}>
      <div className="mb-2.5 flex items-center justify-between gap-2 pl-0.5">
        <SectionTitle id={id} title={title} count={count} />
        {(hint || action) && (
          <div className="flex items-center gap-2">
            {hint && <span className="text-xs font-medium text-fg-muted">{hint}</span>}
            {action}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

/** Karte mit Kopfzeile, Inhalt und optionalem Fuß. */
export function SectionCard({
  title,
  count,
  action,
  footer,
  children,
  className,
}: Omit<SectionProps, "hint"> & { footer?: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("rounded-card border border-line-subtle bg-surface shadow-card", className)}>
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3.5">
        <SectionTitle id={id} title={title} count={count} />
        {action}
      </div>
      <div className="px-4 pb-4">{children}</div>
      {footer && <div className="border-t border-line-subtle px-4 py-3">{footer}</div>}
    </section>
  );
}

/** Kleine Großbuchstaben-Zeile über Gruppen (ersetzt die verstreuten uppercase-Labels). */
export function Overline({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("text-2xs font-semibold uppercase tracking-[.05em] text-fg-muted", className)}>{children}</div>;
}
