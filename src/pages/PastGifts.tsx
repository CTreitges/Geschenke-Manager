import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SurpriseBadge } from "@/components/surprise/SurpriseBadge";
import { Avatar, Chip, EmptyState, Icon, PageHeader } from "@/components/ui";
import { useIdentity } from "@/lib/auth";
import { useStore } from "@/lib/hooks";
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
  const myId = useIdentity();

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
              // Eigene Geschenke ohne Betrag – Details zeigt die Überreicht-Ansicht.
              const mine = isRecipient(g, myId);
              return (
                <button
                  key={g.id}
                  onClick={() => nav(`/gift/${g.id}`)}
                  className="text-left px-3.5 py-3 bg-white dark:bg-stone-800 rounded-2xl border border-[#F0EBE6] dark:border-[#3A3633] flex items-center gap-3 active:scale-[0.99] transition-transform"
                >
                  {p && <Avatar person={p} size={36} />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-bold text-stone-900 dark:text-stone-50 truncate">
                      {p?.name ?? "Unbekannt"}
                    </div>
                    <div className="text-[12px] text-stone-500 dark:text-stone-400 truncate">
                      {occ} {g.year} · {formatDate(g.receivedAt)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {mine ? (
                      <div>
                        <SurpriseBadge label="für dich" />
                      </div>
                    ) : (
                      <div className="text-[14px] font-bold tabular-nums text-violet-700 dark:text-violet-300">
                        {formatEuro(total)}
                      </div>
                    )}
                    <Chip variant="success" className="mt-0.5">erhalten</Chip>
                  </div>
                  <Icon.chev />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
