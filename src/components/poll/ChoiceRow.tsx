import { Check, ExternalLink } from "lucide-react";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatEuro } from "@/lib/money";
import { voteCountLabel, voteShare } from "@/lib/pollView";
import { hostLabel, normalizeUrl } from "@/lib/url";
import type { Person, Suggestion } from "@/lib/types";

/**
 * Eine Idee im Vote- bzw. Entscheidungs-Sheet: die ganze Zeile ist ein
 * Umschalter (aria-pressed, mind. 64 px hoch). Der Shop-Link liegt daneben,
 * nicht im Knopf (keine verschachtelten Bedienelemente).
 */
export function ChoiceRow({
  idea,
  author,
  pressed,
  disabled,
  onToggle,
  voters,
  votedTotal,
  rank,
  winner = false,
  reserveLink = false,
}: {
  idea: Suggestion;
  author?: Person;
  pressed: boolean;
  disabled?: boolean;
  onToggle: () => void;
  /** Wähler dieser Idee; undefined = keine Stimmenanzeige (Direkt entscheiden). */
  voters?: readonly Person[];
  /** Anzahl der Abstimmenden (Nenner des Balkens). */
  votedTotal?: number;
  rank?: number;
  winner?: boolean;
  /** Platz der Link-Spalte auch ohne Link freihalten, damit die Kreise untereinander stehen. */
  reserveLink?: boolean;
}) {
  const href = normalizeUrl(idea.url);
  const host = hostLabel(idea.url);
  const meta = [idea.price != null ? formatEuro(idea.price) : null, author ? `von ${author.name}` : null]
    .filter(Boolean)
    .join(" · ");
  const count = voters?.length ?? 0;
  const total = votedTotal ?? 0;

  return (
    <li
      className={cn(
        "flex items-stretch overflow-hidden rounded-card border bg-surface transition-shadow",
        pressed ? "border-accent ring-2 ring-accent" : "border-line",
      )}
    >
      <button
        type="button"
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onToggle}
        className="flex min-h-16 min-w-0 flex-1 items-start gap-3 px-3.5 py-3 text-left disabled:opacity-60"
      >
        {rank !== undefined && (
          <span aria-hidden className="mt-0.5 w-5 shrink-0 text-center text-meta font-bold text-fg-muted">
            {winner ? "🏆" : rank}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block break-words text-body font-semibold text-fg">{idea.title}</span>
          {meta && <span className="mt-0.5 block text-meta text-fg-muted">{meta}</span>}
          {voters && (
            <span className="mt-2 flex items-center gap-2">
              <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span
                  className="block h-full rounded-full bg-accent"
                  style={{ width: `${Math.round(voteShare(count, total) * 100)}%` }}
                />
              </span>
              <span className="shrink-0 text-2xs font-semibold tabular-nums text-fg-soft">
                {voteCountLabel(count, total)}
              </span>
              {count > 0 && (
                <span aria-hidden className="flex shrink-0">
                  {voters.slice(0, 4).map((p, i) => (
                    <span key={p.id} className={cn(i > 0 && "-ml-1")}>
                      <Avatar person={p} size={18} ring />
                    </span>
                  ))}
                </span>
              )}
            </span>
          )}
        </span>
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2",
            pressed ? "border-transparent bg-grad-primary text-white" : "border-line-control",
          )}
        >
          {pressed && <Check size={16} strokeWidth={3} />}
        </span>
      </button>
      {!href && reserveLink && <span aria-hidden className="min-w-tap" />}
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`„${idea.title}“ ansehen${host ? ` (${host})` : ""}`}
          title={host}
          className="flex min-w-tap items-center justify-center border-l border-line-subtle text-fg-muted hover:text-accent-text"
        >
          <ExternalLink size={16} aria-hidden />
        </a>
      )}
    </li>
  );
}
