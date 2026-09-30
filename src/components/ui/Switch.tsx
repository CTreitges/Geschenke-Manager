import { cn } from "@/lib/cn";

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
