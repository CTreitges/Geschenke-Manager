import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Button, Chip, EmptyState, Icon, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/hooks";
import {
  addSuggestion,
  castVote,
  deleteSuggestion,
  markReceived,
  setPollStatus,
  toggleParticipant,
  updateGift,
} from "@/lib/storage";
import { ageOnNextBirthday, daysUntilBirthday, formatBirthday } from "@/lib/birthdays";
import { pickColor } from "@/lib/colors";
import { getIdentity } from "@/lib/auth";
import { toast } from "sonner";
import type { ReactNode } from "react";

export default function GiftDetail() {
  const { id } = useParams<{ id: string }>();
  const { gifts, persons, suggestions, polls } = useStore();
  const nav = useNavigate();

  const gift = gifts.find((g) => g.id === id);
  if (!gift) return <p className="px-4 py-8">Geschenk nicht gefunden.</p>;
  const person = persons.find((p) => p.id === gift.personId);
  if (!person) return <p className="px-4 py-8">Person nicht gefunden.</p>;

  const giftSuggestions = suggestions.filter((s) => s.giftId === gift.id);
  const poll = polls.find((p) => p.giftId === gift.id);
  const pollStatus = poll?.status ?? "none";

  const myId = getIdentity();
  const me = persons.find((p) => p.id === myId);

  const totalBudget = gift.participantIds.length * gift.budgetPerPerson;

  // Tally votes
  const voteTally: Record<string, string[]> = {};
  giftSuggestions.forEach((s) => (voteTally[s.id] = []));
  if (poll) {
    Object.entries(poll.votes).forEach(([pid, sid]) => {
      if (voteTally[sid]) voteTally[sid].push(pid);
    });
  }
  const winnerId =
    pollStatus === "closed"
      ? Object.entries(voteTally).sort((a, b) => b[1].length - a[1].length)[0]?.[0]
      : null;

  return (
    <div>
      <PageHeader
        onBack={() => nav(-1)}
        title={`Geschenk für ${person.name}`}
        subtitle={`🎁 Jahr ${gift.year} · in ${daysUntilBirthday(person)} Tagen`}
        right={
          <Chip variant={gift.status === "open" ? "info" : "success"}>
            {gift.status === "open" ? "offen" : "erhalten"}
          </Chip>
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
          <button
            onClick={() => nav(`/person/${person.id}`)}
            className="text-stone-400 p-1.5"
          >
            <Icon.chev />
          </button>
        </div>
      </div>

      {/* Teilnehmer */}
      <Section title="Teilnehmer" hint={`${gift.participantIds.length} dabei`}>
        {!me && (
          <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 rounded-xl px-3 py-2 mb-2.5">
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

      {/* Vorschläge */}
      <Section title="Vorschläge" hint={`${giftSuggestions.length}`}>
        {giftSuggestions.length === 0 ? (
          <EmptyState emoji="💡" title="Noch keine Ideen" />
        ) : (
          <div className="flex flex-col gap-2 mb-2.5">
            {giftSuggestions.map((s) => {
              const author = persons.find((p) => p.id === s.suggestedBy);
              const isWinner = s.id === winnerId;
              const voters = voteTally[s.id] || [];
              const myVote = poll && myId ? poll.votes[myId] === s.id : false;
              return (
                <div
                  key={s.id}
                  className="px-3.5 py-3.5 rounded-2xl relative"
                  style={{
                    background: isWinner
                      ? "var(--gm-winner, #FFFBEB)"
                      : undefined,
                    border: isWinner
                      ? "2px solid #F97316"
                      : "1px solid #F0EBE6",
                  }}
                >
                  {!isWinner && (
                    <div className="absolute inset-0 rounded-2xl bg-white dark:bg-stone-800 -z-10 border border-[#F0EBE6] dark:border-[#3A3633]" />
                  )}
                  {isWinner && (
                    <div
                      className="absolute -top-2.5 right-3 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide text-white"
                      style={{
                        background: "linear-gradient(135deg, #F59E0B, #F97316)",
                        boxShadow: "0 4px 10px -2px rgba(249,115,22,0.5)",
                      }}
                    >
                      🏆 Gewonnen
                    </div>
                  )}
                  <div className="flex items-start gap-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-bold text-stone-900 dark:text-stone-50 leading-tight">
                        {s.title}
                      </div>
                      <div className="flex gap-2.5 mt-1.5 items-center text-xs flex-wrap">
                        {s.price != null && (
                          <span className="text-amber-700 dark:text-amber-400 font-semibold">
                            {s.price} €
                          </span>
                        )}
                        {s.url && (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-stone-500 flex items-center gap-1"
                          >
                            <Icon.link /> Link
                          </a>
                        )}
                        <span className="text-stone-400">von {author?.name ?? "?"}</span>
                      </div>
                    </div>
                    {pollStatus === "active" && myId && (
                      <button
                        onClick={() => {
                          castVote(gift.id, myId, s.id);
                          toast.success("Stimme gespeichert");
                        }}
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white"
                        style={{
                          border: myVote ? "none" : "2px solid #D6D3D1",
                          background: myVote
                            ? "linear-gradient(135deg, #F59E0B, #F97316)"
                            : "transparent",
                        }}
                      >
                        {myVote && <Icon.check size={14} />}
                      </button>
                    )}
                    <button
                      onClick={() => deleteSuggestion(s.id)}
                      className="text-stone-300 hover:text-red-500 p-1"
                    >
                      <Icon.x size={16} />
                    </button>
                  </div>
                  {pollStatus !== "none" && voters.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-[#F0EBE6] dark:border-[#3A3633] flex items-center gap-1.5 flex-wrap">
                      <div className="flex">
                        {voters.map((vid, i) => {
                          const voter = persons.find((p) => p.id === vid);
                          return (
                            <div key={vid} style={{ marginLeft: i > 0 ? -6 : 0 }}>
                              <Avatar person={voter} size={20} ring />
                            </div>
                          );
                        })}
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                        {voters.map((v) => persons.find((p) => p.id === v)?.name).filter(Boolean).join(", ")}{" "}
                        {voters.length === 1 ? "hat" : "haben"} gewählt
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <SuggestionAdder giftId={gift.id} myId={myId} />
      </Section>

      {/* Abstimmung */}
      <Section title="Abstimmung">
        {pollStatus === "none" && (
          <div className="text-center py-1">
            <Button onClick={() => {
              if (giftSuggestions.length === 0) {
                toast.error("Erst Vorschläge anlegen");
                return;
              }
              setPollStatus(gift.id, "active");
              toast.success("Abstimmung gestartet");
            }} className="w-full">
              <Icon.vote /> Abstimmung starten
            </Button>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-2 leading-snug">
              Jede Person hat eine Stimme. Stimmen sind sichtbar.
            </p>
          </div>
        )}
        {pollStatus === "active" && (
          <div>
            <div
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-2.5"
              style={{ background: "#FEF3C7" }}
            >
              <span className="text-lg">🗳️</span>
              <div className="flex-1">
                <div className="text-[13px] font-bold text-amber-900">Abstimmung läuft</div>
                <div className="text-xs text-amber-800/80">
                  {Object.keys(poll?.votes ?? {}).length} von {gift.participantIds.length} Stimmen
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
          <div
            className="px-3.5 py-3.5 rounded-xl flex items-center gap-2.5"
            style={{ background: "#FEF3C7" }}
          >
            <span className="text-2xl">🏆</span>
            <div className="flex-1">
              <div className="text-[13px] font-bold text-amber-900">Gewinner steht fest</div>
              <div className="text-xs text-amber-800/85 mt-0.5">
                {giftSuggestions.find((s) => s.id === winnerId)?.title ?? "—"}
              </div>
            </div>
          </div>
        )}
      </Section>

      {gift.status === "open" && (
        <div className="px-4 pt-2 pb-24">
          <Button
            size="lg"
            onClick={() => {
              if (!confirm(`Geschenk für ${person.name} als erhalten markieren?`)) return;
              markReceived(gift.id);
              toast.success("Geschenk erhalten ✓");
              nav("/");
            }}
            className="w-full"
          >
            <Icon.check /> Geschenk erhalten
          </Button>
        </div>
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="px-4 pb-4">
      <div className="flex items-center justify-between mb-2.5 pl-0.5">
        <h3 className="m-0 text-[15px] font-bold text-stone-900 dark:text-stone-50 tracking-tight">{title}</h3>
        {hint && <span className="text-xs text-stone-400 font-medium">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function BudgetEditor({ gift, totalBudget }: { gift: import("@/lib/types").Gift; totalBudget: number }) {
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
              style={{ border: "1px solid #F97316" }}
            />
          ) : (
            <span
              onClick={() => {
                setDraft(String(gift.budgetPerPerson));
                setEditing(true);
              }}
              className="cursor-pointer"
              style={{ borderBottom: "1px dashed #F97316" }}
            >
              {gift.budgetPerPerson} €
            </span>
          )}
        </span>
        <span className="mx-1.5">=</span>
      </div>
      <div className="text-[22px] font-extrabold tracking-tight text-amber-700 dark:text-amber-400">
        {totalBudget} €
      </div>
    </div>
  );
}

function SuggestionAdder({ giftId, myId }: { giftId: string; myId: string | null }) {
  const [text, setText] = useState("");

  function add() {
    if (!text.trim()) {
      return;
    }
    if (!myId) {
      toast.error("Wähle erst in den Einstellungen, wer du bist");
      return;
    }
    addSuggestion({ giftId, title: text.trim(), suggestedBy: myId });
    setText("");
    toast.success("Vorschlag hinzugefügt");
  }

  return (
    <div className="mt-2 p-2.5 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-[#F0EBE6] dark:border-[#3A3633] flex items-center gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
        placeholder="Idee teilen…"
        className="flex-1 outline-none bg-transparent px-1 py-1.5 text-sm text-stone-900 dark:text-stone-50"
      />
      <Button size="sm" onClick={add} disabled={!text.trim()} style={{ minHeight: 32, padding: "6px 12px" }}>
        Teilen
      </Button>
    </div>
  );
}
