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
          <label htmlFor={inputId} className="block text-[13px] font-semibold text-stone-500 dark:text-stone-400 mb-1.5 pl-0.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full px-3.5 py-3 text-[15px] rounded-xl outline-none font-[inherit]",
            "bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-50",
            "border border-stone-200 dark:border-stone-700",
            "focus:border-accent",
            "placeholder:text-stone-400",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
Input.displayName = "Input";
