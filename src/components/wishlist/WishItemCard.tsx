import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { Icon } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatEuro } from "@/lib/money";
import type { WishlistItem } from "@/lib/types";
import { hostLabel, normalizeUrl } from "@/lib/url";
import type { WishBadge } from "@/lib/wishlist";

// ── Wunsch als Karte ──────────────────────────────────────────
// Tippen = Bearbeiten (onOpen) bzw. im Übernahme-Sheet nur Lesen. Der Link
// ist ein eigener Tipp-Bereich. Herzenswünsche tragen Stern + Amber-Kante.
// Spoiler-Schutz: Was in `badges` steht, entscheidet wishBadges() – die
// Besitzerin bekommt dort nie „übernommen“.
export function WishMeta({ wish, addedBy, badges = [] }: { wish: WishlistItem; addedBy?: string | null; badges?: WishBadge[] }) {
  const host = hostLabel(wish.url);
  const parts: ReactNode[] = [];
  if (wish.price != null) parts.push(<span className="font-semibold text-fg">ca. {formatEuro(wish.price)}</span>);
  if (host) parts.push(<span>↗ {host}</span>);
  if (addedBy) parts.push(<span>{addedBy}</span>);
  return (
    <>
      {parts.length > 0 && (
        <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-fg-muted">
          {parts.map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>·</span>}
              {p}
            </span>
          ))}
        </span>
      )}
      {wish.note && <span className="mt-1 block break-words text-meta italic text-fg-soft">„{wish.note}“</span>}
      {badges.length > 0 && (
        <span className="mt-1.5 flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <span
              key={b.label}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold",
                b.kind === "adopted" ? "bg-status-received-soft text-status-received" : "bg-surface-2 text-fg-soft",
              )}
            >
              {b.kind === "adopted" && <Icon.check size={12} />}
              {b.label}
            </span>
          ))}
        </span>
      )}
    </>
  );
}

export function WishItemCard({
  wish,
  addedBy,
  badges,
  onOpen,
  footer,
}: {
  wish: WishlistItem;
  addedBy?: string | null;
  badges?: WishBadge[];
  onOpen: () => void;
  /** Zusatz-Aktionen unter der Karte (z. B. „Noch aktuell ✓“). */
  footer?: ReactNode;
}) {
  const href = normalizeUrl(wish.url);
  const host = hostLabel(wish.url);
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card border border-line-subtle bg-surface shadow-card",
        wish.favorite && "border-l-4 border-l-wish",
      )}
    >
      <div className="flex items-start gap-1 py-1 pl-3.5 pr-1">
        <button type="button" onClick={onOpen} className="min-h-tap min-w-0 flex-1 py-2 text-left">
          <span className="flex items-start gap-1.5">
            {wish.favorite && (
              <>
                <Star size={15} aria-hidden className="mt-0.5 shrink-0 fill-wish text-wish" />
                <span className="sr-only">Herzenswunsch:</span>
              </>
            )}
            <span className="break-words text-body font-semibold leading-snug text-fg">{wish.title}</span>
          </span>
          <WishMeta wish={wish} addedBy={addedBy} badges={badges} />
          <span className="sr-only">, bearbeiten</span>
        </button>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`„${wish.title}“ ansehen${host ? ` (${host})` : ""}`}
            title={host}
            className="inline-flex min-h-tap min-w-tap shrink-0 items-center justify-center text-fg-muted hover:text-accent-text"
          >
            <Icon.link size={16} />
          </a>
        )}
      </div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line-subtle px-3 py-2">{footer}</div>}
    </div>
  );
}
