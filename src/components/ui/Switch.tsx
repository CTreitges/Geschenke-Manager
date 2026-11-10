import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// ── Switch ─────────────────────────────────────────────────────
type SwitchProps = {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  /** Name für Screenreader, falls kein sichtbares Label per aria-labelledby verknüpft ist. */
  label?: string;
  "aria-labelledby"?: string;
  id?: string;
};

export function Switch({ checked, onChange, disabled, label, id, "aria-labelledby": labelledBy }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      onClick={onChange}
      disabled={disabled}
      className="inline-flex min-h-tap shrink-0 items-center disabled:opacity-50"
    >
      <span
        aria-hidden
        className={cn("flex h-7 w-[46px] rounded-full p-0.5 transition-colors", checked ? "bg-grad-primary" : "bg-line-control")}
      >
        <span
          className={cn(
            "h-6 w-6 rounded-full bg-white shadow-md transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0",
          )}
        />
      </span>
    </button>
  );
}

/** Kompatibler Alias für bestehende Aufrufer. */
export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return <Switch checked={on} onChange={onChange} disabled={disabled} />;
}

// ── Segmented ──────────────────────────────────────────────────
/** Neuer Index für Pfeil-/Home-/End-Tasten (umlaufend), sonst null. */
export function nextSegmentIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (current + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

type SegmentedProps<T extends string> = {
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  /** Name der Gruppe für Screenreader. */
  label: string;
  className?: string;
};

export function Segmented<T extends string>({ options, value, onChange, label, className }: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = options.findIndex((o) => o.value === value);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = nextSegmentIndex(Math.max(current, 0), e.key, options.length);
    if (next === null) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={cn("flex gap-1 rounded-btn bg-surface-2 p-1", className)}>
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected || (current < 0 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-8 flex-1 rounded-tile px-3 text-sm font-semibold transition-colors",
              selected ? "bg-surface text-fg shadow-sm" : "text-fg-soft hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
