import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// ── Input ──────────────────────────────────────────────────────
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string }>(
  ({ className, label, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId; // Label per htmlFor verknüpft (Screenreader, Tipp aufs Label fokussiert)
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block pl-0.5 text-meta font-semibold text-fg-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full px-3.5 py-3 text-body rounded-xl outline-none font-[inherit]",
            "bg-surface text-fg",
            // Rand ≥ 3:1 (WCAG 1.4.11), Fokus als Akzent-Rand + Ring
            "border border-line-control",
            "focus:border-accent focus:ring-2 focus:ring-accent/30",
            "placeholder:text-fg-muted",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
Input.displayName = "Input";
