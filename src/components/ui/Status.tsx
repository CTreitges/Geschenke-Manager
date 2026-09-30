import { Check, CircleCheck, Gift, Lightbulb, Vote, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

// ── Phasen eines Geschenks ─────────────────────────────────────
export type PhaseKey = "ideas" | "voting" | "decided" | "received";

export const PHASES: ReadonlyArray<{ key: PhaseKey; label: string }> = [
  { key: "ideas", label: "Ideen" },
  { key: "voting", label: "Abstimmung" },
  { key: "decided", label: "Entschieden" },
  { key: "received", label: "Erhalten" },
];

// Farbe steht nie allein: immer Icon + Text (WCAG 1.4.1).
const STATUS_STYLE: Record<PhaseKey, { icon: LucideIcon; className: string }> = {
  ideas: { icon: Lightbulb, className: "bg-status-open-soft text-status-open" },
  voting: { icon: Vote, className: "bg-status-vote-soft text-status-vote" },
  decided: { icon: CircleCheck, className: "bg-status-done-soft text-status-done" },
  received: { icon: Gift, className: "bg-status-received-soft text-status-received" },
};

export function phaseLabel(key: PhaseKey): string {
  return PHASES.find((p) => p.key === key)?.label ?? key;
}

/** Status-Chip, z. B. <StatusBadge status="voting" meta="3/5 · noch 2 T." />. */
export function StatusBadge({ status, meta, className }: { status: PhaseKey; meta?: string; className?: string }) {
  const { icon: StatusIcon, className: tone } = STATUS_STYLE[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", tone, className)}>
      {status === "voting" && (
        // Pulsierender Punkt: „läuft gerade“. Bei reduzierter Bewegung steht er still (index.css).
        <span aria-hidden className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      )}
      <StatusIcon size={14} aria-hidden className="shrink-0" />
      <span>
        {phaseLabel(status)}
        {meta && ` · ${meta}`}
      </span>
    </span>
  );
}

/** Fortschritt über die 4 Phasen: erledigt (Häkchen), aktuell (Verlauf), offen (Rand). */
export function PhaseStepper({ current, className }: { current: PhaseKey; className?: string }) {
  const idx = PHASES.findIndex((p) => p.key === current);
  return (
    <ol aria-label="Phasen" className={cn("m-0 flex list-none items-start p-0", className)}>
      {PHASES.map((p, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={p.key} aria-current={active ? "step" : undefined} className="relative flex flex-1 flex-col items-center gap-1 text-center">
            {i > 0 && (
              // Verbindungslinie von der Mitte des vorigen Schritts bis zur Mitte dieses Schritts.
              <span aria-hidden className={cn("absolute right-1/2 top-[11px] h-0.5 w-full", i <= idx ? "bg-accent" : "bg-line")} />
            )}
            <span
              aria-hidden
              className={cn(
                // z-10: über der Verbindungslinie des nächsten Schritts (die liegt im DOM dahinter).
                "relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-2xs font-bold",
                done && "bg-accent text-surface",
                active && "bg-grad-primary text-white ring-4 ring-accent-soft",
                !done && !active && "border-2 border-line-control bg-surface text-fg-muted",
              )}
            >
              {done ? <Check size={14} strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn("text-2xs font-semibold", active ? "text-fg" : done ? "text-fg-soft" : "text-fg-muted")}>
              {p.label}
              {done && <span className="sr-only"> (erledigt)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
