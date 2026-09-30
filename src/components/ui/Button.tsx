import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icons";

// ── Button ─────────────────────────────────────────────────────
type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
type BtnSize = "sm" | "md" | "lg";
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }>(
  ({ className, variant = "primary", size = "md", style, ...props }, ref) => {
    const sizes: Record<BtnSize, CSSProperties> = {
      sm: { padding: "8px 12px", fontSize: 14, minHeight: 36 },
      md: { padding: "12px 18px", fontSize: 15, minHeight: 44 },
      lg: { padding: "14px 22px", fontSize: 16, minHeight: 50 },
    };
    const variants: Record<BtnVariant, CSSProperties> = {
      primary: {
        background: "linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)",
        color: "#fff",
        boxShadow: "0 6px 16px -4px rgba(124,58,237,0.45), 0 1px 0 rgba(255,255,255,0.3) inset",
      },
      secondary: {},
      ghost: { background: "transparent" },
      danger: {},
    };
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-semibold rounded-[14px] transition-[transform,box-shadow,opacity] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
          variant === "secondary" && "bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 border border-stone-200 dark:border-stone-700",
          variant === "ghost" && "text-stone-900 dark:text-stone-50 hover:bg-stone-100 dark:hover:bg-stone-800",
          variant === "danger" && "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-200",
          className,
        )}
        style={{ ...sizes[size], ...variants[variant], ...style }}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

// ── FAB ────────────────────────────────────────────────────────
export function FAB({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed right-5 bottom-24 z-40 w-14 h-14 rounded-full text-white border-none flex items-center justify-center"
      style={{
        background: "linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)",
        boxShadow: "0 14px 28px -8px rgba(124,58,237,0.55), 0 0 0 1px rgba(255,255,255,0.2) inset",
      }}
    >
      <Icon.plus size={26} />
    </button>
  );
}
