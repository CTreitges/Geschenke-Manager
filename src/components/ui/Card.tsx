import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

// ── Card ───────────────────────────────────────────────────────
export function Card({ className, children, onClick, style }: { className?: string; children: ReactNode; onClick?: () => void; style?: CSSProperties }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-surface rounded-card border border-line-subtle shadow-card", // gleiche Werte wie zuvor, jetzt als Tokens
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
    neutral: "bg-surface-2 text-fg-soft",
    accent: "bg-accent-soft text-accent-text",
    success: "bg-status-received-soft text-status-received",
    info: "bg-status-open-soft text-status-open",
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
