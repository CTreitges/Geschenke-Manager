import { Icon } from "@/components/ui";
import { formatRelativeDate } from "@/lib/dates";
import type { WishlistItem } from "@/lib/types";

// ── Wishlist row (with adopt button) ─────────────────────────
export function WishlistRow({
  wish,
  taken,
  onAdopt,
}: {
  wish: WishlistItem;
  taken: boolean;
  onAdopt: () => void;
}) {
  return (
    <div
      className="px-3.5 py-3 rounded-2xl flex items-start gap-2.5"
      style={{
        background: taken
          ? "rgba(16, 185, 129, 0.06)"
          : "rgba(245, 158, 11, 0.06)",
        border: taken
          ? "1px solid rgba(16, 185, 129, 0.25)"
          : "1px solid rgba(245, 158, 11, 0.25)",
      }}
    >
      <span className="text-lg pt-0.5">🎁</span>
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] font-semibold text-stone-900 dark:text-stone-50 leading-snug">
          {wish.title}
        </div>
        <div className="flex gap-2.5 mt-1.5 items-center text-xs flex-wrap">
          {wish.price != null && (
            <span className="text-violet-700 dark:text-violet-300 font-semibold">
              {wish.price} €
            </span>
          )}
          {wish.url && (
            <a
              href={wish.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-500 dark:text-stone-400 no-underline flex items-center gap-1"
            >
              <Icon.link /> Link
            </a>
          )}
          <span className="text-stone-400">
            {formatRelativeDate(wish.createdAt) || "—"}
          </span>
        </div>
      </div>
      {taken ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-md bg-emerald-100/50 dark:bg-emerald-950/40 shrink-0 mt-0.5">
          <Icon.check size={12} /> übernommen
        </span>
      ) : (
        <button
          onClick={onAdopt}
          className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-white shrink-0 mt-0.5 active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
        >
          Übernehmen
        </button>
      )}
    </div>
  );
}
