import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import type { Person } from "@/lib/types";
import { initials } from "@/lib/colors";

// ── Icons ──────────────────────────────────────────────────────
type IconProps = { size?: number; className?: string; style?: CSSProperties };
const sw = (n = 2) => ({ strokeWidth: n });
export const Icon = {
  back: ({ size = 22, ...p }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...sw()} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  ),
  plus: ({ size = 20, ...p }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...sw(2.2)} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  check: ({ size = 18, ...p }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...sw(2.4)} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  pencil: ({ size = 16, ...p }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...sw()} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  trash: ({ size = 18, ...p }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...sw()} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14" />
    </svg>
  ),
  drag: ({ size = 16, ...p }: IconProps) => (
    <svg width={size} height={size * 1.25} viewBox="0 0 16 20" fill="currentColor" {...p}>
      <circle cx="5" cy="4" r="1.6" /><circle cx="11" cy="4" r="1.6" />
      <circle cx="5" cy="10" r="1.6" /><circle cx="11" cy="10" r="1.6" />
      <circle cx="5" cy="16" r="1.6" /><circle cx="11" cy="16" r="1.6" />
    </svg>
  ),
  link: ({ size = 14, ...p }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...sw()} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  ),
  gift: ({ size = 22, ...p }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...sw()} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 110-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 100-5C13 2 12 7 12 7z" />
    </svg>
  ),
  users: ({ size = 20, ...p }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...sw()} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  home: ({ size = 20, ...p }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...sw()} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  cog: ({ size = 20, ...p }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...sw()} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  lock: ({ size = 20, ...p }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...sw()} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
  x: ({ size = 18, ...p }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...sw(2.4)} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  chev: ({ size = 14, ...p }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...sw(2.4)} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
  vote: ({ size = 18, ...p }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...sw()} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  ),
  mail: ({ size = 18, ...p }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...sw()} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  moon: ({ size = 18, ...p }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" {...sw()} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  ),
};

// ── Avatar ─────────────────────────────────────────────────────
import { pickColor } from "@/lib/colors";
export function Avatar({ person, size = 36, ring = false }: { person: Person | null | undefined; size?: number; ring?: boolean }) {
  if (!person) return null;
  const color = person.color || pickColor(person.id || person.name);
  return (
    <div
      className="inline-flex items-center justify-center font-semibold text-white shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        fontSize: size * 0.38,
        letterSpacing: 0.3,
        boxShadow: ring
          ? `0 0 0 2px var(--gm-bg), 0 0 0 ${size > 30 ? 4 : 3}px ${color}`
          : "none",
      }}
    >
      {initials(person.name)}
    </div>
  );
}

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

// ── Bottom-sheet Dialog ────────────────────────────────────────
// Rendered via portal into document.body so it is NEVER trapped inside
// an ancestor stacking context (e.g. the sticky header uses
// backdrop-blur, which scopes `position: fixed` to the header otherwise).
export function Dialog({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null;
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center animate-fadeIn">
      <div onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-stone-50 dark:bg-stone-900 rounded-t-[24px] flex flex-col max-h-[85vh] pb-[env(safe-area-inset-bottom,24px)] animate-slideUp"
      >
        <div className="pt-3 pb-2 flex justify-center">
          <div className="w-9 h-[5px] rounded-full bg-stone-300 dark:bg-stone-700" />
        </div>
        {title && (
          <div className="px-5 pb-3 pt-1 flex items-center justify-between">
            <h3 className="m-0 text-lg font-bold text-stone-900 dark:text-stone-50">{title}</h3>
            <button
              onClick={onClose}
              className="bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 w-8 h-8 rounded-full flex items-center justify-center"
            >
              <Icon.x />
            </button>
          </div>
        )}
        <div className="px-5 pb-4 flex-1 overflow-auto">{children}</div>
        {footer && <div className="px-5 pt-2.5 border-t border-stone-200 dark:border-stone-800">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ── Page Header (sticky) ───────────────────────────────────────
export function PageHeader({ onBack, title, subtitle, right }: { onBack?: () => void; title?: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div
      className="sticky top-14 z-20 px-4 pt-3 pb-3.5"
      style={{
        background:
          "linear-gradient(to bottom, var(--gm-bg) 80%, transparent)",
      }}
    >
      <div className="flex items-center gap-2 min-h-9">
        {onBack && (
          <button
            onClick={onBack}
            className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full w-9 h-9 flex items-center justify-center shrink-0 text-stone-900 dark:text-stone-50"
          >
            <Icon.back />
          </button>
        )}
        <div className="flex-1 min-w-0">
          {title && (
            <h1 className="m-0 text-[22px] font-bold text-stone-900 dark:text-stone-50 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
              {title}
            </h1>
          )}
          {subtitle && <div className="text-[13px] text-stone-500 dark:text-stone-400 mt-0.5 font-medium">{subtitle}</div>}
        </div>
        {right}
      </div>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────
export function EmptyState({ emoji, title, subtitle, action }: { emoji: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="px-6 py-10 text-center flex flex-col items-center gap-2">
      <div className="text-[44px] mb-1.5">{emoji}</div>
      <div className="text-[15px] font-bold text-stone-900 dark:text-stone-50">{title}</div>
      {subtitle && <div className="text-[13px] text-stone-500 dark:text-stone-400 max-w-[260px] leading-[1.5]">{subtitle}</div>}
      {action && <div className="mt-2.5">{action}</div>}
    </div>
  );
}

// ── Confetti ───────────────────────────────────────────────────
export function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const dots = Array.from({ length: 18 }, (_, i) => ({
    left: `${(i * 7 + 5) % 100}%`,
    delay: (i * 0.18) % 3,
    color: ["#6366F1", "#7C3AED", "#EC4899", "#8B5CF6", "#06B6D4"][i % 5],
    size: 4 + (i % 3) * 2,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit]">
      {dots.map((d, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: -10,
            left: d.left,
            width: d.size,
            height: d.size * 1.4,
            background: d.color,
            borderRadius: 1,
            opacity: 0.7,
            animation: `confettiFall 3.4s linear ${d.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ── Toggle ─────────────────────────────────────────────────────
export function Toggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className="w-[46px] h-7 rounded-full p-0.5 flex transition-colors disabled:opacity-50"
      style={{
        background: on
          ? "linear-gradient(135deg, #6366F1, #7C3AED)"
          : undefined,
      }}
    >
      <div
        className={cn(
          "w-6 h-6 rounded-full bg-white shadow-md transition-transform",
          !on && "bg-stone-300 dark:bg-stone-600",
        )}
        style={{ transform: on ? "translateX(18px)" : "translateX(0)", background: on ? "#fff" : undefined }}
      />
    </button>
  );
}

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
