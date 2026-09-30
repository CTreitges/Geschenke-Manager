import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconButton } from "./Button";
import { Icon } from "./icons";
import { Sheet } from "./Sheet";
import { whenHistorySettled } from "./sheetStack";

export type ActionMenuItem = {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  /** danger: rot, für Löschen o. Ä. */
  tone?: "danger";
  disabled?: boolean;
  /** Zweite Zeile, z. B. der Grund für disabled. */
  hint?: string;
};

// ── ActionMenu: ⋯-Knopf öffnet ein Sheet mit Aktionen ──────────
export function ActionMenu({ items, label = "Weitere Aktionen", title }: { items: ActionMenuItem[]; label?: string; title?: string }) {
  const [open, setOpen] = useState(false);
  const pendingRef = useRef<(() => void) | null>(null);

  // Aktion erst ausführen, wenn das Sheet samt History-Eintrag weg ist –
  // sonst würde ein navigate() in der Aktion vom history.back() überholt.
  useEffect(() => {
    if (open) return;
    const run = pendingRef.current;
    if (!run) return;
    pendingRef.current = null;
    void whenHistorySettled().then(run);
  }, [open]);

  return (
    <>
      <IconButton label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon.more />
      </IconButton>
      <Sheet open={open} onClose={() => setOpen(false)} title={title ?? label}>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {items.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  pendingRef.current = item.onSelect;
                  setOpen(false);
                }}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 rounded-btn px-3 py-2 text-left text-body font-semibold hover:bg-surface-2 disabled:opacity-50",
                  item.tone === "danger" ? "text-danger" : "text-fg",
                )}
              >
                {item.icon && (
                  <span aria-hidden className="shrink-0">
                    {item.icon}
                  </span>
                )}
                <span className="flex-1">
                  {item.label}
                  {item.hint && <span className="block text-meta font-normal text-fg-muted">{item.hint}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
