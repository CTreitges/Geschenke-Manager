import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Button, Chip, Dialog, EmptyState, Icon, Input, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/hooks";
import {
  addSuggestion,
  castVote,
  deleteGift,
  deleteSuggestion,
  markConfirmed,
  markReceived,
  removeVote,
  setAllParticipants,
  setGiftSelections,
  setPollStatus,
  toggleParticipant,
  unconfirmGift,
  updateGift,
  updateSuggestion,
} from "@/lib/storage";
import { ageOnNextBirthday, daysUntilBirthday, formatBirthday } from "@/lib/birthdays";
import { pickColor } from "@/lib/colors";
import { getGroupId, useIdentity } from "@/lib/auth";
import { formatRelativeDate } from "@/lib/dates";
import { toast } from "sonner";
import type { Gift, GiftStatus, Suggestion, Poll, Person, WishlistItem } from "@/lib/types";

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

  const gift = gifts.find((g) => g.id === id);
  if (!gift) return <p className="px-4 py-8">Geschenk nicht gefunden.</p>;
  const person = persons.find((p) => p.id === gift.personId);
  if (!person) return <p className="px-4 py-8">Person nicht gefunden.</p>;

  const giftId = gift.id;
  const giftSuggestions = suggestions.filter((s) => s.giftId === giftId);
  const personWishes = useMemo(
    () =>
      [...wishlist.filter((w) => w.personId === gift.personId)].sort(
        (a, b) => b.createdAt - a.createdAt,
      ),
    [wishlist, gift.personId],
  );
  const poll = polls.find((p) => p.giftId === gift.id);
  const pollStatus = poll?.status ?? "none";
  const me = persons.find((p) => p.id === myId);
  const totalBudget = gift.participantIds.length * gift.budgetPerPerson;
  const selectedIds = gift.selectedSuggestionIds ?? [];

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
      <Section
        title="Teilnehmer"
        hint={`${gift.participantIds.length} dabei`}
        action={
          <ParticipantBulkButtons
            personIds={persons.filter((p) => p.id !== gift.personId).map((p) => p.id)}
            participantIds={gift.participantIds}
            onSet={(ids) => setAllParticipants(gift.id, ids)}
          />
        }
      >
        {!me && (
          <div className="text-xs text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-950 rounded-xl px-3 py-2 mb-2.5">
            Wähle in den Einstellungen, wer du bist, bevor du teilnimmst oder abstimmst.
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {persons
            .filter((p) => p.id !== gift.personId)
            .map((p) => {
              const joined = gift.participantIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleParticipant(gift.id, p.id)}
                  className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-[13px] font-semibold border transition-colors"
                  style={
                    joined
                      ? {
                          background: `linear-gradient(135deg, ${p.color || pickColor(p.id)}, ${(p.color || pickColor(p.id))}dd)`,
                          color: "#fff",
                          border: "1px solid transparent",
                        }
                      : { background: "transparent" }
                  }
                >
                  <Avatar person={p} size={22} />
                  {p.name}
                  {joined && <Icon.check size={14} className="ml-0.5" />}
                </button>
              );
            })}
        </div>
        <BudgetEditor gift={gift} totalBudget={totalBudget} />
      </Section>

      {/* ── Wunschliste der Person — nur solange offen ────────── */}
      {gift.status === "open" && (
        <Section
          title={`Wunschliste von ${person.name}`}
          hint={personWishes.length > 0 ? `${personWishes.length}` : undefined}
        >
          {personWishes.length === 0 ? (
            <div className="text-[13px] text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/50 rounded-xl px-3.5 py-3 border border-[#F0EBE6] dark:border-[#3A3633]">
              Noch keine Wünsche von {person.name}. Wenn {person.name} sich was wünscht, taucht es hier
              auf — und ihr könnt es mit einem Tipp in die Vorschläge übernehmen.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {personWishes.map((w) => (
                <WishlistRow
                  key={w.id}
                  wish={w}
                  taken={giftSuggestions.some((s) => s.fromWishItemId === w.id)}
                  onAdopt={() => {
                    addSuggestion({
                      giftId,
                      title: w.title,
                      url: w.url,
                      price: w.price,
                      suggestedBy: myId ?? gift.personId,
                      fromWishItemId: w.id,
                    });
                    toast.success("In Vorschläge übernommen");
                  }}
                />
              ))}
            </div>
          )}
        </Section>
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
              removeVote(giftId, myId);
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
                    castVote(giftId, myId, s.id);
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
      <Section title="Abstimmung">
        {pollStatus === "none" && (
          <div className="text-center py-1">
            <Button
              onClick={() => {
                if (giftSuggestions.length === 0) {
                  toast.error("Erst Vorschläge anlegen");
                  return;
                }
                setPollStatus(gift.id, "active");
                toast.success("Abstimmung gestartet");
              }}
              className="w-full"
            >
              <Icon.vote /> Abstimmung starten
            </Button>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-2 leading-snug">
              Jede Person kann beliebig viele Vorschläge wählen. Stimmen sind sichtbar.
            </p>
          </div>
        )}

        {pollStatus === "active" && (
          <div>
            <div
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-2.5 bg-violet-100 dark:bg-violet-950"
            >
              <span className="text-lg">🗳️</span>
              <div className="flex-1">
                <div className="text-[13px] font-bold text-violet-800 dark:text-violet-300">
                  Abstimmung läuft
                </div>
                <div className="text-xs text-violet-700/80 dark:text-violet-400/80">
                  {Object.keys(poll?.votes ?? {}).filter(
                    (pid) => (poll?.votes[pid]?.length ?? 0) > 0,
                  ).length}
                  {" "}von {gift.participantIds.length} haben abgestimmt
                </div>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setPollStatus(gift.id, "closed");
                toast.success("Abstimmung beendet");
              }}
              className="w-full"
            >
              Abstimmung beenden
            </Button>
          </div>
        )}

        {pollStatus === "closed" && (
          <ClosedPollSummary
            poll={poll!}
            tally={voteTally}
            totalVotes={totalVotes}
            winnerId={winnerId}
            suggestions={giftSuggestions}
            onOpenDetails={() => setPollDetailsOpen(true)}
            onAdoptWinner={autoSelectWinner}
            onReopen={() => {
              if (confirm("Abstimmung wieder öffnen? Bestehende Stimmen bleiben erhalten.")) {
                setPollStatus(gift.id, "active");
                toast.success("Abstimmung erneut geöffnet");
              }
            }}
            onClear={() => {
              if (confirm("Abstimmung komplett verwerfen? Stimmen gehen verloren.")) {
                setPollStatus(gift.id, "none");
                toast.success("Abstimmung verworfen");
              }
            }}
          />
        )}
      </Section>
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
      <div className="px-4 pt-2 pb-2 space-y-2.5">
        {gift.status === "open" && selectedIds.length > 0 && (
          <Button
            size="lg"
            onClick={() => {
              markConfirmed(gift.id);
              toast.success("Auswahl bestätigt ✓");
            }}
            className="w-full"
          >
            <Icon.check /> Auswahl bestätigen
          </Button>
        )}
        {gift.status === "confirmed" && (
          <Button
            size="lg"
            onClick={() => {
              if (!confirm(`Geschenk für ${person.name} als erhalten markieren?`)) return;
              markReceived(gift.id);
              toast.success("Geschenk erhalten ✓");
              // Dialog nur öffnen, wenn ausgewählte Vorschläge noch keinen
              // Bezahler haben.
              const selected = giftSuggestions.filter((s) =>
                (gift.selectedSuggestionIds ?? []).includes(s.id),
              );
              const missing = selected.some((s) => !s.paidBy);
              if (missing) {
                setNavHomeAfterPayment(true);
                setPaymentDialogOpen(true);
              } else {
                nav("/");
              }
            }}
            className="w-full"
          >
            <Icon.check /> Geschenk erhalten
          </Button>
        )}
        {gift.status === "confirmed" && (
          <Button
            variant="secondary"
            onClick={() => {
              unconfirmGift(gift.id);
              toast.success("Bestätigung aufgehoben");
            }}
            className="w-full"
          >
            <Icon.x size={16} /> Bestätigung aufheben
          </Button>
        )}
        {gift.status === "open" && selectedIds.length === 0 && (
          <Button
            size="lg"
            variant="secondary"
            onClick={() => {
              if (!confirm(`Geschenk für ${person.name} als erhalten markieren?\n\nKein Vorschlag ausgewählt — die Bestätigung wird übersprungen.`)) return;
              markReceived(gift.id);
              toast.success("Geschenk erhalten ✓");
              nav("/");
            }}
            className="w-full"
          >
            <Icon.check /> Geschenk erhalten
          </Button>
        )}
        <Button
          variant="danger"
          onClick={() => {
            if (
              !confirm(
                `Geschenk komplett löschen?\n\nAlle ${giftSuggestions.length} Vorschläge und die Abstimmung gehen verloren.`,
              )
            )
              return;
            deleteGift(gift.id);
            toast.success("Geschenk gelöscht");
            nav("/");
          }}
          className="w-full"
        >
          <Icon.trash /> Geschenk löschen
        </Button>
      </div>

      <div className="pb-24" />

      {/* ── Poll-Details Modal ────────────────────────────────── */}
      {poll && pollStatus === "closed" && (
        <Dialog open={pollDetailsOpen} onClose={() => setPollDetailsOpen(false)} title="Abstimmungs-Ergebnis">
          <div className="space-y-3">
            <div className="text-sm text-stone-500 dark:text-stone-400">
              {totalVotes} {totalVotes === 1 ? "Stimme" : "Stimmen"} insgesamt
            </div>
            {[...giftSuggestions]
              .sort((a, b) => (voteTally[b.id]?.length ?? 0) - (voteTally[a.id]?.length ?? 0))
              .map((s) => {
                const voters = voteTally[s.id] || [];
                const pct = totalVotes ? Math.round((voters.length / totalVotes) * 100) : 0;
                return (
                  <div
                    key={s.id}
                    className="px-3.5 py-3 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-stone-900 dark:text-stone-50">
                        {s.title}
                      </div>
                      <div className="text-sm font-bold tabular-nums text-violet-700 dark:text-violet-300">
                        {pct}% · {voters.length}
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-600 to-violet-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {voters.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {voters.map((vid) => {
                          const v = persons.find((p) => p.id === vid);
                          return v ? (
                            <span
                              key={vid}
                              className="inline-flex items-center gap-1 text-xs text-stone-600 dark:text-stone-300"
                            >
                              <Avatar person={v} size={18} />
                              {v.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </Dialog>
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

// ── Share-Dialog ──────────────────────────────────────────────
function ShareDialog({
  open,
  onClose,
  giftId,
  personName,
}: {
  open: boolean;
  onClose: () => void;
  giftId: string;
  personName: string;
}) {
  const groupId = getGroupId();
  const shareUrl = groupId
    ? `${window.location.origin}/g/${groupId}/gift/${giftId}`
    : null;
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Clipboard nicht verfügbar");
    }
  }

  async function nativeShare() {
    if (!shareUrl) return;
    try {
      await navigator.share({
        title: `Geschenk für ${personName}`,
        text: "Schau dir das Geschenk an und mach mit!",
        url: shareUrl,
      });
    } catch {
      // user cancelled or not supported
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Geschenk teilen">
      <div className="space-y-4">
        <p className="text-[13px] text-stone-500 dark:text-stone-400 leading-[1.5]">
          Schick diesen Link an Personen, die beim Geschenk mitmachen sollen. Sie werden direkt
          zum Geschenk weitergeleitet — nach Login falls nötig.
        </p>
        {shareUrl ? (
          <>
            <div
              className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 cursor-pointer"
              onClick={copyLink}
            >
              <Icon.link size={14} className="text-stone-400 shrink-0" />
              <span className="flex-1 text-[13px] font-mono text-stone-600 dark:text-stone-300 truncate">
                {shareUrl}
              </span>
            </div>
            <Button onClick={copyLink} className="w-full" variant={copied ? "secondary" : "primary"}>
              {copied ? <><Icon.check size={16} /> Kopiert!</> : <><Icon.copy size={16} /> Link kopieren</>}
            </Button>
            {typeof navigator.share === "function" && (
              <Button onClick={nativeShare} variant="secondary" className="w-full">
                <Icon.share size={16} /> Teilen...
              </Button>
            )}
          </>
        ) : (
          <p className="text-[13px] text-red-500">Kein aktiver Gruppenkontext.</p>
        )}
      </div>
    </Dialog>
  );
}

// ── Dezente Bezahler-Summen-Zeile ─────────────────────────────
// Eine schlanke Zeile am Ende des Geschenk-Details: pro Person ein
// kleiner Avatar + Name + Summe. Erscheint nur, sobald mindestens ein
// paidBy gesetzt ist. Keine Header-Box, kein Hinweistext.
function PayerTotalsLine({
  selectedSuggestions,
  personsById,
}: {
  selectedSuggestions: Suggestion[];
  personsById: Record<string, Person>;
}) {
  const byPayer = new Map<string, number>();
  selectedSuggestions.forEach((s) => {
    if (!s.paidBy) return;
    byPayer.set(s.paidBy, (byPayer.get(s.paidBy) ?? 0) + (s.price ?? 0));
  });
  if (byPayer.size === 0) return null;
  const payers = [...byPayer.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="px-4 pb-3">
      <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap text-[12px] text-stone-500 dark:text-stone-400">
        <span className="shrink-0">💶 Bezahlt:</span>
        {payers.map(([pid, total]) => {
          const p = personsById[pid];
          return (
            <span key={pid} className="inline-flex items-center gap-1">
              {p && <Avatar person={p} size={16} />}
              <span className="text-stone-700 dark:text-stone-200">
                {p?.name ?? "?"}
              </span>
              <span className="font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                {total} €
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── Payment-Dialog (nach Geschenk-erhalten) ───────────────────
function PaymentDialog({
  open,
  onClose,
  selectedSuggestions,
  participants,
  onSetPaidBy,
}: {
  open: boolean;
  onClose: () => void;
  selectedSuggestions: Suggestion[];
  participants: Person[];
  onSetPaidBy: (suggestionId: string, personId: string | undefined) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="💶 Wer hat was bezahlt?">
      <div className="space-y-3 px-5 pb-2">
        <p className="text-[13px] text-stone-500 dark:text-stone-400 leading-snug">
          Trag pro Vorschlag ein, wer's bezahlt hat. Kannst du auch später noch anpassen.
        </p>
        {selectedSuggestions.length === 0 ? (
          <div className="text-[13px] text-stone-500 dark:text-stone-400 italic">
            Keine ausgewählten Vorschläge.
          </div>
        ) : (
          selectedSuggestions.map((s) => (
            <div
              key={s.id}
              className="px-3 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 space-y-2"
            >
              <div className="text-[14px] font-semibold text-stone-900 dark:text-stone-50">
                {s.title}
                {s.price != null && (
                  <span className="ml-2 text-violet-700 dark:text-violet-300">
                    · {s.price} €
                  </span>
                )}
              </div>
              <select
                value={s.paidBy ?? ""}
                onChange={(e) => onSetPaidBy(s.id, e.target.value || undefined)}
                className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
              >
                <option value="">— Bezahler wählen —</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          ))
        )}
        <div className="pt-2">
          <Button onClick={onClose} className="w-full">
            Fertig
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ── Section wrapper ───────────────────────────────────────────
function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="px-4 pb-4">
      <div className="flex items-center justify-between mb-2.5 pl-0.5 gap-2">
        <h3 className="m-0 text-[15px] font-bold text-stone-900 dark:text-stone-50 tracking-tight">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {hint && <span className="text-xs text-stone-400 font-medium">{hint}</span>}
          {action}
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Participant bulk buttons ──────────────────────────────────
function ParticipantBulkButtons({
  personIds,
  participantIds,
  onSet,
}: {
  personIds: string[];
  participantIds: string[];
  onSet: (ids: string[]) => void;
}) {
  const allActive = personIds.length > 0 && personIds.every((id) => participantIds.includes(id));
  return (
    <button
      onClick={() => {
        if (allActive) onSet([]);
        else onSet(personIds);
      }}
      className="text-xs font-semibold text-violet-700 dark:text-violet-400 px-2 py-1 rounded-md hover:bg-violet-50 dark:hover:bg-violet-950"
    >
      {allActive ? "Alle entfernen" : "Alle hinzufügen"}
    </button>
  );
}

// ── My-vote banner ────────────────────────────────────────────
// Multi-Vote: zeigt alle Vorschläge, für die ich gestimmt habe (mit Komma
// getrennt). Zurücknehmen leert alle eigenen Stimmen auf einmal.
function MyVoteBanner({
  myVotedSuggestions,
  onClearAll,
}: {
  myVotedSuggestions: Suggestion[];
  onClearAll: () => void;
}) {
  const has = myVotedSuggestions.length > 0;
  return (
    <div
      className="mb-2.5 px-3.5 py-2.5 rounded-xl flex items-center gap-2.5"
      style={{
        background: has ? "rgba(124, 58, 237, 0.08)" : "rgba(245, 158, 11, 0.08)",
        border: `1px solid ${has ? "rgba(124, 58, 237, 0.2)" : "rgba(245, 158, 11, 0.25)"}`,
      }}
    >
      <span className="text-base">{has ? "✓" : "🗳️"}</span>
      <div className="flex-1 text-[13px] min-w-0">
        {has ? (
          <>
            <span className="text-stone-500 dark:text-stone-400">
              Du hast {myVotedSuggestions.length === 1 ? "gewählt:" : `${myVotedSuggestions.length}× gewählt:`}
            </span>{" "}
            <span className="font-semibold text-stone-900 dark:text-stone-50">
              {myVotedSuggestions.map((s) => s.title).join(", ")}
            </span>
            <div className="text-xs text-stone-400 mt-0.5">
              Du darfst beliebig viele Vorschläge wählen — Klick toggelt die
              jeweilige Stimme.
            </div>
          </>
        ) : (
          <span className="font-semibold text-amber-800 dark:text-amber-300">
            Du hast noch nicht gestimmt — wähle einen oder mehrere Vorschläge.
          </span>
        )}
      </div>
      {has && (
        <button
          onClick={onClearAll}
          className="text-xs font-semibold text-violet-700 dark:text-violet-300 px-2 py-1 rounded-md hover:bg-violet-50 dark:hover:bg-violet-950 shrink-0"
        >
          Alle zurücknehmen
        </button>
      )}
    </div>
  );
}

// ── Selected summary ──────────────────────────────────────────
// `provisional` schaltet das Wording um: "Theoretische Gesamtsumme" (open)
// vs. "Gesamtsumme" (confirmed/received). `allowEdit` blendet im
// confirmed/received-State die Entfernen-/Alle-löschen-Buttons aus.
function SelectedSummary({
  selectedIds,
  suggestions,
  sum,
  provisional,
  allowEdit,
  onRemove,
  onClear,
}: {
  selectedIds: string[];
  suggestions: Suggestion[];
  sum: number;
  provisional: boolean;
  allowEdit: boolean;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const selected = selectedIds
    .map((id) => suggestions.find((s) => s.id === id))
    .filter((s): s is Suggestion => !!s);
  return (
    <div className="mt-3 px-3.5 py-3 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[13px] font-bold text-violet-700 dark:text-violet-300">
          {selected.length} ausgewählt ·{" "}
          {provisional ? "Theoretische Gesamtsumme" : "Gesamtsumme"}
        </div>
        <div className="text-[20px] font-extrabold text-violet-700 dark:text-violet-300 tabular-nums">
          {sum} €
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {selected.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-2 text-[13px] py-1"
          >
            <div className="flex-1 min-w-0 truncate text-stone-700 dark:text-stone-200">
              {s.title}
            </div>
            <span className="text-violet-700 dark:text-violet-300 font-semibold tabular-nums">
              {s.price != null ? `${s.price} €` : "—"}
            </span>
            {allowEdit && (
              <button
                onClick={() => onRemove(s.id)}
                className="text-stone-400 hover:text-red-500 px-1"
                aria-label="Aus Auswahl entfernen"
              >
                <Icon.x size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      {allowEdit && selected.length > 1 && (
        <button
          onClick={onClear}
          className="mt-1.5 text-xs font-semibold text-violet-700/80 dark:text-violet-400/80"
        >
          Alle entfernen
        </button>
      )}
    </div>
  );
}

// ── Suggestion card (with inline edit) ────────────────────────
function SuggestionCard({
  suggestion: s,
  author,
  voters,
  personsById,
  pollStatus,
  myVote,
  myId,
  isWinner,
  isSelected,
  onToggleSelect,
  onVote,
  onSave,
  onDelete,
  giftStatus,
  participants,
  onSetPaidBy,
}: {
  suggestion: Suggestion;
  author?: Person;
  voters: string[];
  personsById: Record<string, Person>;
  pollStatus: Poll["status"] | "none";
  myVote: boolean;
  myId: string | null;
  isWinner: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onVote: () => void;
  onSave: (patch: Partial<Suggestion>) => void;
  onDelete: () => void;
  giftStatus: GiftStatus;
  participants: Person[];
  onSetPaidBy: (personId: string | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(s.title);
  const [url, setUrl] = useState(s.url ?? "");
  const [price, setPrice] = useState(s.price != null ? String(s.price) : "");

  function startEdit() {
    setTitle(s.title);
    setUrl(s.url ?? "");
    setPrice(s.price != null ? String(s.price) : "");
    setEditing(true);
  }

  function save() {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSave({
      title: trimmed,
      url: url.trim() || undefined,
      price: price ? +price : undefined,
    });
    setEditing(false);
  }

  return (
    <div
      className="px-3.5 py-3.5 rounded-2xl relative bg-white dark:bg-stone-800 border"
      style={{
        borderColor: isWinner ? "#7C3AED" : isSelected ? "#A78BFA" : undefined,
        borderWidth: isWinner || isSelected ? 2 : 1,
        borderStyle: "solid",
      }}
    >
      {isWinner && (
        <div
          className="absolute -top-2.5 right-3 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide text-white"
          style={{
            background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
            boxShadow: "0 4px 10px -2px rgba(124,58,237,0.5)",
          }}
        >
          🏆 Gewonnen
        </div>
      )}
      <div className="flex items-start gap-2.5">
        {/* Selection checkbox */}
        <button
          onClick={onToggleSelect}
          aria-label={isSelected ? "Auswahl aufheben" : "Auswählen"}
          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 text-white"
          style={{
            background: isSelected
              ? "linear-gradient(135deg, #4F46E5, #7C3AED)"
              : "transparent",
            border: isSelected ? "none" : "2px solid #D6D3D1",
          }}
        >
          {isSelected && <Icon.check size={14} />}
        </button>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <Input
                placeholder="Titel"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                className="py-2 text-[14px]"
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Link (optional)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-[2] py-2 text-[13px]"
                />
                <Input
                  placeholder="€"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="flex-1 py-2 text-[13px]"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs font-semibold text-stone-500 px-2 py-1.5 rounded-md"
                >
                  Abbrechen
                </button>
                <button
                  onClick={save}
                  disabled={!title.trim()}
                  className="text-xs font-semibold text-violet-700 dark:text-violet-300 px-2 py-1.5 rounded-md disabled:opacity-50"
                >
                  Speichern
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-[15px] font-bold text-stone-900 dark:text-stone-50 leading-tight">
                {s.title}
              </div>
              <div className="flex gap-2.5 mt-1.5 items-center text-xs flex-wrap">
                {s.price != null && (
                  <span className="text-violet-700 dark:text-violet-300 font-semibold">
                    {s.price} €
                  </span>
                )}
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-stone-500 flex items-center gap-1"
                  >
                    <Icon.link /> Link
                  </a>
                )}
                <span className="text-stone-400">von {author?.name ?? "?"}</span>
                {s.fromWishItemId && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                    🎁 Wunschzettel
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {!editing && (
          <>
            {pollStatus === "active" && myId && (
              <button
                onClick={onVote}
                aria-label={myVote ? "Deine Stimme — klick zum Ändern" : "Wählen"}
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white"
                style={{
                  border: myVote ? "none" : "2px solid #D6D3D1",
                  background: myVote
                    ? "linear-gradient(135deg, #4F46E5, #7C3AED)"
                    : "transparent",
                }}
              >
                {myVote && <Icon.check size={14} />}
              </button>
            )}
            <button
              onClick={startEdit}
              className="text-stone-300 hover:text-violet-600 p-1"
              aria-label="Bearbeiten"
              title="Bearbeiten"
            >
              <Icon.pencil />
            </button>
            <button
              onClick={onDelete}
              className="text-stone-300 hover:text-red-500 p-1"
              aria-label="Löschen"
              title="Löschen"
            >
              <Icon.x size={16} />
            </button>
          </>
        )}
      </div>

      {!editing && pollStatus !== "none" && voters.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-stone-100 dark:border-stone-700 flex items-center gap-1.5 flex-wrap">
          <div className="flex">
            {voters.map((vid, i) => (
              <div key={vid} style={{ marginLeft: i > 0 ? -6 : 0 }}>
                <Avatar person={personsById[vid]} size={20} ring />
              </div>
            ))}
          </div>
          <div className="text-xs text-stone-500 dark:text-stone-400 font-medium">
            {voters.map((v) => personsById[v]?.name).filter(Boolean).join(", ")}{" "}
            {voters.length === 1 ? "hat" : "haben"} gewählt
          </div>
        </div>
      )}

      {/* Selected-for-group badge — sichtbar für alle */}
      {!editing && isSelected && (
        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 dark:bg-violet-950 text-violet-800 dark:text-violet-300">
          ✓ Für Gesamtsumme ausgewählt
        </div>
      )}

      {/* PaidBy-Dropdown: schon im offenen Status verfügbar — wird nach
          "Geschenk erhalten" gefestigt. */}
      {!editing && isSelected && (
        <div className="mt-2.5 pt-2.5 border-t border-stone-100 dark:border-stone-700 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-stone-700 dark:text-stone-200 shrink-0">
              💶 Bezahlt von:
            </span>
            <select
              value={s.paidBy ?? ""}
              onChange={(e) => onSetPaidBy(e.target.value || undefined)}
              className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
            >
              <option value="">— wählen —</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {s.paidBy && personsById[s.paidBy] && (
              <Avatar person={personsById[s.paidBy]} size={22} />
            )}
          </div>
          {giftStatus === "open" && (
            <div className="text-[11px] text-amber-700 dark:text-amber-300/90 flex items-center gap-1">
              📝 vorläufig — wird nach Erhalten gefestigt
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Closed-poll summary (compact) ─────────────────────────────
function ClosedPollSummary({
  poll: _poll,
  tally,
  totalVotes,
  winnerId,
  suggestions,
  onOpenDetails,
  onAdoptWinner,
  onReopen,
  onClear,
}: {
  poll: Poll;
  tally: Record<string, string[]>;
  totalVotes: number;
  winnerId: string | null;
  suggestions: Suggestion[];
  onOpenDetails: () => void;
  onAdoptWinner: () => void;
  onReopen: () => void;
  onClear: () => void;
}) {
  const winner = suggestions.find((s) => s.id === winnerId);
  const winnerVotes = winner ? (tally[winner.id]?.length ?? 0) : 0;
  const winnerPct = totalVotes ? Math.round((winnerVotes / totalVotes) * 100) : 0;

  return (
    <div className="space-y-2.5">
      <div className="px-3.5 py-3.5 rounded-xl bg-violet-100 dark:bg-violet-950 flex items-center gap-2.5">
        <span className="text-2xl">🏆</span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-violet-800 dark:text-violet-300">
            {winner ? winner.title : "Kein Gewinner"}
          </div>
          <div className="text-xs text-violet-700/85 dark:text-violet-400/85">
            {winnerPct}% · {winnerVotes} von {totalVotes}{" "}
            {totalVotes === 1 ? "Stimme" : "Stimmen"}
          </div>
        </div>
        <button
          onClick={onOpenDetails}
          className="text-xs font-semibold text-violet-700 dark:text-violet-300 px-2.5 py-1.5 rounded-md hover:bg-white/30 dark:hover:bg-white/10"
        >
          Details
        </button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {winner && (
          <Button size="sm" variant="secondary" onClick={onAdoptWinner}>
            Gewinner als Auswahl übernehmen
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onReopen}>
          Wieder öffnen
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          Verwerfen
        </Button>
      </div>
    </div>
  );
}

// ── Budget editor ─────────────────────────────────────────────
function BudgetEditor({ gift, totalBudget }: { gift: Gift; totalBudget: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(gift.budgetPerPerson));

  return (
    <div className="px-3.5 py-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-[#F0EBE6] dark:border-[#3A3633] flex items-center justify-between">
      <div className="text-[13px] text-stone-500 dark:text-stone-400">
        <span className="text-[15px] font-bold text-stone-900 dark:text-stone-50">
          {gift.participantIds.length} ×{" "}
          {editing ? (
            <input
              type="number"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                if (draft) updateGift(gift.id, { budgetPerPerson: parseFloat(draft) });
                setEditing(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-12 px-1 py-0.5 rounded-md text-[15px] font-bold bg-transparent text-stone-900 dark:text-stone-50 outline-none"
              style={{ border: "1px solid #7C3AED" }}
            />
          ) : (
            <span
              onClick={() => {
                setDraft(String(gift.budgetPerPerson));
                setEditing(true);
              }}
              className="cursor-pointer"
              style={{ borderBottom: "1px dashed #7C3AED" }}
            >
              {gift.budgetPerPerson} €
            </span>
          )}
        </span>
        <span className="mx-1.5">=</span>
      </div>
      <div className="text-[22px] font-extrabold tracking-tight text-violet-700 dark:text-violet-300">
        {totalBudget} €
      </div>
    </div>
  );
}

// ── Wishlist row (with adopt button) ─────────────────────────
function WishlistRow({
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

// ── Suggestion adder with optional link + price ──────────────
function SuggestionAdder({ giftId, myId }: { giftId: string; myId: string | null }) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [showExtra, setShowExtra] = useState(false);

  function add() {
    if (!text.trim()) return;
    if (!myId) {
      toast.error("Wähle erst in den Einstellungen, wer du bist");
      return;
    }
    addSuggestion({
      giftId,
      title: text.trim(),
      url: url.trim() || undefined,
      price: price ? +price : undefined,
      suggestedBy: myId,
    });
    setText("");
    setUrl("");
    setPrice("");
    setShowExtra(false);
    toast.success("Vorschlag hinzugefügt");
  }

  return (
    <div className="mt-2 p-2.5 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-[#F0EBE6] dark:border-[#3A3633]">
      <div className="flex items-center gap-2">
        <span className="text-base pl-1 shrink-0">💡</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Idee teilen…"
          className="flex-1 min-w-0 outline-none bg-transparent px-1 py-1.5 text-stone-900 dark:text-stone-50"
        />
        <Button
          size="sm"
          onClick={add}
          disabled={!text.trim()}
          className="shrink-0"
          style={{ minHeight: 32, padding: "6px 12px" }}
        >
          Teilen
        </Button>
      </div>
      {!showExtra && text && (
        <button
          onClick={() => setShowExtra(true)}
          className="block w-full mt-1 py-1 pl-7 text-left text-[12px] font-semibold text-violet-700 dark:text-violet-400"
        >
          + Link / Preis
        </button>
      )}
      {showExtra && (
        <div className="flex gap-2 mt-2 pl-7">
          <Input
            placeholder="Link (optional)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-[2] py-2"
          />
          <Input
            placeholder="€"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="flex-1 py-2"
          />
        </div>
      )}
    </div>
  );
}

// ── WhatsApp / Chat-Link Section ──────────────────────────────
function WhatsappLinkSection({ gift }: { gift: Gift }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(gift.whatsappLink ?? "");

  function save() {
    const trimmed = draft.trim();
    updateGift(gift.id, { whatsappLink: trimmed || undefined });
    setEditing(false);
    toast.success(trimmed ? "Gruppen-Link gespeichert" : "Gruppen-Link entfernt");
  }

  if (gift.whatsappLink && !editing) {
    return (
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
          <span className="text-lg shrink-0">💬</span>
          <a
            href={gift.whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-0 text-[14px] font-semibold text-emerald-800 dark:text-emerald-300 truncate"
          >
            Gruppen-Chat öffnen
          </a>
          <button
            onClick={() => {
              setDraft(gift.whatsappLink ?? "");
              setEditing(true);
            }}
            aria-label="Link bearbeiten"
            className="text-emerald-700 dark:text-emerald-400 p-1.5 shrink-0"
          >
            <Icon.pencil />
          </button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="px-4 pb-3">
        <div className="px-3.5 py-3 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 space-y-2">
          <label className="text-[12px] font-semibold text-stone-500 dark:text-stone-400">
            Gruppen-Link (z.B. WhatsApp-Einladung)
          </label>
          <Input
            type="url"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://chat.whatsapp.com/..."
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)} className="flex-1">
              Abbrechen
            </Button>
            <Button onClick={save} className="flex-1">
              Speichern
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-3">
      <button
        onClick={() => setEditing(true)}
        className="w-full text-left px-3.5 py-2.5 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 text-[13px] text-stone-500 dark:text-stone-400 hover:border-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
      >
        💬 Gruppen-Link hinzufügen (WhatsApp o.ä.)
      </button>
    </div>
  );
}
