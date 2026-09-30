import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// ── Input ──────────────────────────────────────────────────────
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string }>(
  ({ className, label, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-[13px] font-semibold text-stone-500 dark:text-stone-400 mb-1.5 pl-0.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full px-3.5 py-3 text-[15px] rounded-xl outline-none font-[inherit]",
            "bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-50",
            "border border-stone-200 dark:border-stone-700",
            "focus:border-indigo-500 dark:focus:border-indigo-500",
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
