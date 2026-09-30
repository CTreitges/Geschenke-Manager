import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Chip, EmptyState, Icon, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/hooks";
import {
  clearMyVotes,
  deleteSuggestion,
  setMyVote,
  setGiftSelections,
  updateSuggestion,
} from "@/lib/storage";
import { ageOnNextBirthday, daysUntilBirthday, formatBirthday } from "@/lib/birthdays";
import { pickColor } from "@/lib/colors";
import { useIdentity } from "@/lib/auth";
import { toast } from "sonner";
import type { Suggestion, Person } from "@/lib/types";
import { GiftActions } from "@/components/gift/GiftActions";
import { MyVoteBanner } from "@/components/gift/MyVoteBanner";
import { ParticipantsSection } from "@/components/gift/ParticipantsSection";
import { PayerTotalsLine } from "@/components/gift/PayerTotalsLine";
import { PaymentDialog } from "@/components/gift/PaymentDialog";
import { PollDetailsDialog } from "@/components/gift/PollDetailsDialog";
import { PollSection } from "@/components/gift/PollSection";
import { Section } from "@/components/gift/Section";
import { SelectedSummary } from "@/components/gift/SelectedSummary";
import { ShareDialog } from "@/components/gift/ShareDialog";
import { SuggestionAdder } from "@/components/gift/SuggestionAdder";
import { SuggestionCard } from "@/components/gift/SuggestionCard";
import { WhatsappLinkSection } from "@/components/gift/WhatsappLinkSection";
import { WishlistAdoptSection } from "@/components/gift/WishlistAdoptSection";

export default function GiftDetail() {
  const { id } = useParams<{ id: string }>();
  const { gifts, persons, suggestions, polls, wishlist } = useStore();
  const nav = useNavigate();
  const myId = useIdentity();
  const [pollDetailsOpen, setPollDetailsOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Wird gesetzt, wenn der Dialog im Zuge von "Geschenk erhalten" geöffnet
  // wurde — dann soll das Schließen zurück auf die Startseite. Bei reinem
  // "Bearbeiten" aus der Übersicht bleibt der User auf der Geschenk-Seite.
  const [navHomeAfterPayment, setNavHomeAfterPayment] = useState(false);

  // WICHTIG: Alle Hooks müssen VOR den Early-Returns laufen. Sonst ändert
  // sich die Hook-Reihenfolge zwischen zwei Renders (gift erst undefined →
  // Early-Return ohne useMemo, dann vorhanden → useMemo läuft), z.B. beim
  // Direkt-Aufruf einer /gift/:id-URL mit noch kaltem Firestore-Cache. React
  // wirft dann "rendered more hooks than during the previous render".
  const gift = gifts.find((g) => g.id === id);
  const person = persons.find((p) => p.id === gift?.personId);
  const poll = polls.find((p) => p.giftId === gift?.id);

  const giftSuggestions = useMemo(
    () => (gift ? suggestions.filter((s) => s.giftId === gift.id) : []),
    [suggestions, gift?.id],
  );
  const personWishes = useMemo(
    () =>
      gift
        ? [...wishlist.filter((w) => w.personId === gift.personId)].sort(
            (a, b) => b.createdAt - a.createdAt,
          )
        : [],
    [wishlist, gift?.personId],
  );
  // ── Vote tally ────────────────────────────────────────────────
  // Multi-Vote: pro Person kann es mehrere suggestionIds geben. Im Tally
  // taucht eine Person mehrfach auf — einmal pro Vorschlag den sie wählt.
  const voteTally = useMemo(() => {
    const tally: Record<string, string[]> = {};
    giftSuggestions.forEach((s) => (tally[s.id] = []));
    if (poll) {
      Object.entries(poll.votes).forEach(([pid, sids]) => {
        sids.forEach((sid) => {
          if (tally[sid]) tally[sid].push(pid);
        });
      });
    }
    return tally;
  }, [giftSuggestions, poll]);

  // Erst NACH allen Hooks die Guards — Hook-Reihenfolge bleibt konstant.
  if (!gift) return <p className="px-4 py-8">Geschenk nicht gefunden.</p>;
  if (!person) return <p className="px-4 py-8">Person nicht gefunden.</p>;

  const giftId = gift.id;
  const pollStatus = poll?.status ?? "none";
  const me = persons.find((p) => p.id === myId);
  const totalBudget = gift.participantIds.length * gift.budgetPerPerson;
  const selectedIds = gift.selectedSuggestionIds ?? [];

  const myVotes = (myId && poll?.votes[myId]) || [];

  const totalVotes = Object.values(voteTally).reduce((a, v) => a + v.length, 0);
  const winnerId =
    pollStatus === "closed"
      ? Object.entries(voteTally).sort((a, b) => b[1].length - a[1].length)[0]?.[0]
      : null;

  // ── Selection helpers ─────────────────────────────────────────
  const selectedSum = selectedIds
    .map((sid) => giftSuggestions.find((s) => s.id === sid)?.price ?? 0)
    .reduce((a, b) => a + b, 0);

  function toggleSelection(sid: string) {
    const next = selectedIds.includes(sid)
      ? selectedIds.filter((x) => x !== sid)
      : [...selectedIds, sid];
    setGiftSelections(giftId, next);
  }

  function autoSelectWinner() {
    if (winnerId && !selectedIds.includes(winnerId)) {
      setGiftSelections(giftId, [winnerId]);
      toast.success("Gewinner übernommen");
    }
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        onBack={() => nav(-1)}
        title={`Geschenk für ${person.name}`}
        subtitle={`🎁 Jahr ${gift.year} · in ${daysUntilBirthday(person)} Tagen`}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShareOpen(true)}
              className="w-9 h-9 rounded-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-600 dark:text-stone-300 shrink-0"
              title="Geschenk teilen"
            >
              <Icon.share size={16} />
            </button>
            <Chip
              variant={
                gift.status === "open"
                  ? "info"
                  : gift.status === "confirmed"
                    ? "accent"
                    : "success"
              }
            >
              {gift.status === "open"
                ? "offen"
                : gift.status === "confirmed"
                  ? "bestätigt"
                  : "erhalten"}
            </Chip>
          </div>
        }
      />

      {/* Person banner */}
      <div className="px-4 pb-4">
        <div
          className="px-3.5 py-3.5 rounded-2xl flex items-center gap-3"
          style={{
            background: `linear-gradient(135deg, ${(person.color || pickColor(person.id))}22, ${(person.color || pickColor(person.id))}08)`,
            border: `1px solid ${(person.color || pickColor(person.id))}33`,
          }}
        >
          <Avatar person={person} size={44} />
          <div className="flex-1">
            <div className="text-[15px] font-bold text-stone-900 dark:text-stone-50">{person.name}</div>
            <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              {formatBirthday(person)}
              {ageOnNextBirthday(person) && ` · wird ${ageOnNextBirthday(person)}`}
            </div>
          </div>
          <button onClick={() => nav(`/person/${person.id}`)} className="text-stone-400 p-1.5">
            <Icon.chev />
          </button>
        </div>
      </div>

      {/* ── Gruppen-Chat (z.B. WhatsApp) ──────────────────────── */}
      <WhatsappLinkSection gift={gift} />

      {/* ── Teilnehmer ────────────────────────────────────────── */}
      <ParticipantsSection
        gift={gift}
        persons={persons}
        me={me}
        totalBudget={totalBudget}
      />

      {/* ── Wunschliste der Person — nur solange offen ────────── */}
      {gift.status === "open" && (
        <WishlistAdoptSection
          gift={gift}
          person={person}
          personWishes={personWishes}
          giftSuggestions={giftSuggestions}
          myId={myId}
        />
      )}

      {/* ── Vorschläge mit Auswahl ────────────────────────────── */}
      <Section title="Vorschläge" hint={`${giftSuggestions.length}`}>
        {/* My-vote banner during active poll — Mehrfach-Auswahl möglich */}
        {pollStatus === "active" && myId && (
          <MyVoteBanner
            myVotedSuggestions={myVotes
              .map((sid) => giftSuggestions.find((s) => s.id === sid))
              .filter((s): s is Suggestion => !!s)}
            onClearAll={() => {
              clearMyVotes(giftId, myId);
              toast.success("Alle Stimmen zurückgenommen");
            }}
          />
        )}

        {giftSuggestions.length === 0 ? (
          <EmptyState emoji="💡" title="Noch keine Ideen" />
        ) : (
          <div className="flex flex-col gap-2 mb-2.5">
            {giftSuggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                author={persons.find((p) => p.id === s.suggestedBy)}
                voters={voteTally[s.id] || []}
                personsById={Object.fromEntries(persons.map((p) => [p.id, p]))}
                pollStatus={pollStatus}
                myVote={myVotes.includes(s.id)}
                myId={myId}
                isWinner={s.id === winnerId}
                isSelected={selectedIds.includes(s.id)}
                onToggleSelect={() => toggleSelection(s.id)}
                giftStatus={gift.status}
                participants={gift.participantIds
                  .map((pid) => persons.find((p) => p.id === pid))
                  .filter((p): p is Person => !!p)}
                onSetPaidBy={(pid) => {
                  updateSuggestion(s.id, { paidBy: pid });
                  toast.success(pid ? "Bezahler eingetragen" : "Bezahler entfernt");
                }}
                onVote={() => {
                  if (myId) {
                    const was = myVotes.includes(s.id);
                    setMyVote(giftId, myId, s.id, !was);
                    toast.success(was ? "Stimme entfernt" : "Stimme gespeichert");
                  }
                }}
                onSave={(patch) => {
                  updateSuggestion(s.id, patch);
                  toast.success("Vorschlag gespeichert");
                }}
                onDelete={() => {
                  if (confirm(`Vorschlag „${s.title}" löschen?`)) {
                    deleteSuggestion(s.id);
                    toast.success("Gelöscht");
                  }
                }}
              />
            ))}
          </div>
        )}
        {gift.status === "open" && (
          <SuggestionAdder giftId={giftId} myId={myId} />
        )}

        {selectedIds.length > 0 && (
          <SelectedSummary
            selectedIds={selectedIds}
            suggestions={giftSuggestions}
            sum={selectedSum}
            provisional={gift.status === "open"}
            allowEdit={gift.status === "open"}
            onRemove={(sid) =>
              setGiftSelections(giftId, selectedIds.filter((x) => x !== sid))
            }
            onClear={() => setGiftSelections(giftId, [])}
          />
        )}
      </Section>

      {/* ── Abstimmung — nur im offenen Status ────────────────── */}
      {gift.status === "open" && (
        <PollSection
          gift={gift}
          poll={poll}
          myId={myId}
          pollStatus={pollStatus}
          giftSuggestions={giftSuggestions}
          voteTally={voteTally}
          totalVotes={totalVotes}
          winnerId={winnerId}
          onOpenDetails={() => setPollDetailsOpen(true)}
          onAdoptWinner={autoSelectWinner}
        />
      )}

      {/* ── Dezente Bezahlt-Übersicht (unten, ab confirmed) ─────── */}
      {gift.status !== "open" && (
        <PayerTotalsLine
          selectedSuggestions={giftSuggestions.filter((s) =>
            (gift.selectedSuggestionIds ?? []).includes(s.id),
          )}
          personsById={Object.fromEntries(persons.map((p) => [p.id, p]))}
        />
      )}

      {/* ── CTAs ─────────────────────────────────────────────── */}
      <GiftActions
        gift={gift}
        person={person}
        giftSuggestions={giftSuggestions}
        selectedIds={selectedIds}
        onAskPayment={() => {
          setNavHomeAfterPayment(true);
          setPaymentDialogOpen(true);
        }}
      />

      <div className="pb-24" />

      {/* ── Poll-Details Modal ────────────────────────────────── */}
      {poll && pollStatus === "closed" && (
        <PollDetailsDialog
          open={pollDetailsOpen}
          onClose={() => setPollDetailsOpen(false)}
          totalVotes={totalVotes}
          giftSuggestions={giftSuggestions}
          voteTally={voteTally}
          persons={persons}
        />
      )}

      {/* ── Payment-Dialog ────────────────────────────────────── */}
      <PaymentDialog
        open={paymentDialogOpen}
        onClose={() => {
          setPaymentDialogOpen(false);
          if (navHomeAfterPayment) {
            setNavHomeAfterPayment(false);
            nav("/");
          }
        }}
        selectedSuggestions={giftSuggestions.filter((s) =>
          (gift.selectedSuggestionIds ?? []).includes(s.id),
        )}
        participants={gift.participantIds
          .map((pid) => persons.find((p) => p.id === pid))
          .filter((p): p is Person => !!p)}
        onSetPaidBy={(sid, pid) => updateSuggestion(sid, { paidBy: pid })}
      />

      {/* ── Share-Dialog ─────────────────────────────────────── */}
      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        giftId={gift.id}
        personName={person.name}
      />
    </div>
  );
}
