import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./Button";
import { Icon } from "./icons";

type QuickAddProps = {
  /** Name des Eingabefelds für Screenreader (sichtbar ist nur der Placeholder). */
  label: string;
  placeholder?: string;
  /** Name des Plus-Knopfs. */
  submitLabel?: string;
  /**
   * Bekommt den getrimmten Text. Erfolgreich → Feld wird geleert. Wirft die
   * Funktion, bleibt der Text stehen; die Fehlermeldung (Toast) ist Sache des Aufrufers.
   */
  onAdd: (text: string) => void | Promise<void>;
  /** Gesetzt → Feld und Knopf gesperrt, der Grund steht darunter (z. B. während der Abstimmung). */
  disabledReason?: string;
  icon?: ReactNode;
  className?: string;
};

// ── QuickAdd: Eingabe + Plus ───────────────────────────────────
export function QuickAdd({ label, placeholder, submitLabel = "Hinzufügen", onAdd, disabledReason, icon, className }: QuickAddProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const reasonId = useId();
  const disabled = !!disabledReason;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || disabled || busy) return;
    setBusy(true);
    try {
      await onAdd(value);
      setText("");
    } catch {
      // Text bleibt stehen; der Aufrufer meldet den Fehler.
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={cn("w-full", className)}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-btn border border-line bg-surface pl-3.5 pr-1 focus-within:ring-2 focus-within:ring-accent",
          disabled && "opacity-60",
        )}
      >
        {icon && (
          <span aria-hidden className="shrink-0 text-fg-muted">
            {icon}
          </span>
        )}
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
        <input
          id={inputId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          aria-describedby={disabled ? reasonId : undefined}
          enterKeyHint="done"
          className="min-w-0 flex-1 bg-transparent py-3 text-base text-fg outline-none placeholder:text-fg-muted"
        />
        <IconButton type="submit" label={submitLabel} variant="primary" size="sm" disabled={disabled || busy || !text.trim()}>
          <Icon.plus size={18} />
        </IconButton>
      </div>
      {disabledReason && (
        <p id={reasonId} className="m-0 mt-1.5 flex items-center gap-1.5 text-meta text-fg-muted">
          <Lock size={14} aria-hidden className="shrink-0" />
          {disabledReason}
        </p>
      )}
    </form>
  );
}
