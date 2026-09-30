import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

// ── Card ───────────────────────────────────────────────────────
export function Card({ className, children, onClick, style }: { className?: string; children: ReactNode; onClick?: () => void; style?: CSSProperties }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white dark:bg-stone-800 rounded-[20px] border border-[#F0EBE6] dark:border-[#3A3633]",
        "shadow-[0_1px_2px_rgba(28,25,23,0.04),0_4px_14px_-8px_rgba(28,25,23,0.08)]",
        "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        onClick && "cursor-pointer",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

// ── Chip ───────────────────────────────────────────────────────
type ChipVariant = "neutral" | "accent" | "success" | "info";
export function Chip({ children, variant = "neutral", className, onClick, style }: { children: ReactNode; variant?: ChipVariant; className?: string; onClick?: () => void; style?: CSSProperties }) {
  const variants: Record<ChipVariant, string> = {
    neutral: "bg-[#F5F1ED] dark:bg-[#3A3633] text-stone-600 dark:text-stone-200",
    accent: "bg-violet-100 dark:bg-[#2E1065] text-violet-800 dark:text-violet-300",
    success: "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300",
    info: "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300",
  };
  return (
    <span
      onClick={onClick}
      style={style}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-[0.01em]",
        variants[variant],
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </span>
  );
}
