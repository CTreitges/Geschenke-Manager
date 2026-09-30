import { forwardRef, type ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { Icon } from "./icons";

// ── Button ─────────────────────────────────────────────────────
type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
type BtnSize = "sm" | "md" | "lg";

const BTN_SIZES: Record<BtnSize, string> = {
  sm: "min-h-10 px-3 py-2 text-sm", // 40 px
  md: "min-h-11 px-[18px] py-3 text-body", // 44 px
  lg: "min-h-[52px] px-[22px] py-3.5 text-base", // 52 px
};

const BTN_VARIANTS: Record<BtnVariant, string> = {
  primary: "bg-grad-primary text-white shadow-primary",
  secondary: "bg-surface text-fg border border-line",
  ghost: "bg-transparent text-fg hover:bg-surface-2",
  danger: "bg-danger-soft text-danger",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: BtnSize;
  /** Zeigt einen Spinner, setzt aria-busy und sperrt den Button. */
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading = false, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold rounded-btn transition-[transform,box-shadow,opacity] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
        BTN_SIZES[size],
        BTN_VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {loading && <LoaderCircle size={18} className="animate-spin shrink-0" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

// ── IconButton ─────────────────────────────────────────────────
// Trefferfläche immer ≥ 44×44 px; die sichtbare Fläche bleibt 32/36 px.
type IconBtnVariant = "ghost" | "soft" | "outline" | "primary";

const ICON_VARIANTS: Record<IconBtnVariant, string> = {
  ghost: "text-fg-muted group-hover:bg-surface-2",
  soft: "bg-surface-2 text-fg-muted",
  outline: "bg-surface border border-line text-fg",
  primary: "bg-grad-primary text-white shadow-primary",
};

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  /** Pflicht: Name für Screenreader (aria-label) und Tooltip. */
  label: string;
  variant?: IconBtnVariant;
  tone?: "neutral" | "danger";
  /** Sichtbare Größe: sm = 32 px, md = 36 px. */
  size?: "sm" | "md";
  /** Umschalt-Knopf: setzt aria-pressed. */
  pressed?: boolean;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, variant = "ghost", tone = "neutral", size = "md", pressed, className, children, title, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={title ?? label}
      aria-pressed={pressed}
      className={cn(
        "group inline-flex items-center justify-center min-w-tap min-h-tap shrink-0 rounded-full disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex items-center justify-center rounded-full transition-colors",
          size === "sm" ? "w-8 h-8" : "w-9 h-9",
          ICON_VARIANTS[variant],
          tone === "danger" && variant !== "primary" && "text-danger",
        )}
      >
        {children}
      </span>
    </button>
  ),
);
IconButton.displayName = "IconButton";

// ── FAB ────────────────────────────────────────────────────────
/** Schwebender Plus-Knopf; mit `text` als beschrifteter „Extended FAB“. */
export function FAB({ onClick, label = "Hinzufügen", text }: { onClick: () => void; label?: string; text?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      // Abstand wie bisher (bottom-24), plus Safe-Area – sonst überlappt die Tab-Bar auf iPhones.
      className={cn(
        "fixed right-5 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-40 h-14 rounded-full text-white border-none flex items-center justify-center gap-1.5 bg-grad-primary shadow-[0_14px_28px_-8px_rgba(124,58,237,0.55),inset_0_0_0_1px_rgba(255,255,255,0.2)]",
        text ? "pl-4 pr-5 text-body font-semibold" : "w-14",
      )}
    >
      <Icon.plus size={text ? 22 : 26} />
      {text}
    </button>
  );
}
