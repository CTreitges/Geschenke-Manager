import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SurpriseBadge } from "@/components/surprise/SurpriseBadge";
import { Avatar, Chip, EmptyState, Icon, PageHeader } from "@/components/ui";
import { useMyId, useStore } from "@/lib/hooks";
import { useBack } from "@/lib/nav";
import { formatEuro } from "@/lib/money";
import { isRecipient } from "@/lib/spoiler";

/**
 * History view: every received gift across all people, newest first.
 * Click an entry to jump to the gift's detail (incl. payment summary).
 */
export default function PastGifts() {
  const { gifts, persons, suggestions } = useStore();
  const nav = useNavigate();
  const back = useBack("/");
  const myId = useMyId();

  const past = useMemo(
    () =>
      [...gifts.filter((g) => g.status === "received")].sort(
        (a, b) => (b.receivedAt ?? b.enteredStackAt) - (a.receivedAt ?? a.enteredStackAt),
      ),
    [gifts],
  );

  const personById = useMemo(
    () => Object.fromEntries(persons.map((p) => [p.id, p])),
    [persons],
  );

  function giftTotal(giftId: string): number {
    const gift = gifts.find((g) => g.id === giftId);
    if (!gift) return 0;
    const sel = gift.selectedSuggestionIds ?? [];
    if (sel.length > 0) {
      return suggestions
        .filter((s) => sel.includes(s.id))
        .reduce((sum, s) => sum + (s.price ?? 0), 0);
    }
    return gift.participantIds.length * gift.budgetPerPerson;
  }

  function formatDate(ts: number | undefined): string {
    if (!ts) return "";
    const d = new Date(ts);
    const months = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  return (
    <>
      <PageHeader
        onBack={back}
        title="Alte Geschenke"
        subtitle={`${past.length} ${past.length === 1 ? "erhaltenes" : "erhaltene"} Geschenk${past.length === 1 ? "" : "e"}`}
      />

      <div className="px-4 pb-24">
        {past.length === 0 ? (
          <EmptyState
            emoji="🎁"
            title="Noch kein altes Geschenk"
            subtitle="Sobald ihr ein Geschenk als erhalten markiert, taucht es hier auf."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {past.map((g) => {
              const p = personById[g.personId];
              const total = giftTotal(g.id);
              const occ = g.occasion ?? "Geburtstag";
              // Eigene Geschenke (und ohne Identität alle) ohne Betrag – Details
              // zeigt die Überreicht-Ansicht bzw. erst nach „Wer bist du?“.
              const mine = isRecipient(g, myId);
              const hideAmount = mine || !myId;
              return (
                <button
                  key={g.id}
                  onClick={() => nav(`/gift/${g.id}`)}
                  type="button"
                  className="flex items-center gap-3 rounded-card border border-line-subtle bg-surface px-3.5 py-3 text-left shadow-card transition-transform active:scale-[0.99]"
                >
                  {p && <Avatar person={p} size={36} />}
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-body font-bold text-fg">{p?.name ?? "Unbekannt"}</div>
                    <div className="text-xs text-fg-muted">
                      {occ} {g.year}
                      {g.receivedAt ? ` · ${formatDate(g.receivedAt)}` : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {mine ? (
                      <div>
                        <SurpriseBadge label="für dich" />
                      </div>
                    ) : hideAmount ? null : (
                      <div className="text-sm font-bold tabular-nums text-accent-text">
                        {formatEuro(total)}
                      </div>
                    )}
                    <Chip variant="success" className="mt-0.5">erhalten</Chip>
                  </div>
                  <Icon.chev className="shrink-0 text-fg-muted" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
