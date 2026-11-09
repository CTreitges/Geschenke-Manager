import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useIdentityPrompt } from "@/components/IdentitySheet";
import { SurpriseBadge } from "@/components/surprise/SurpriseBadge";
import { useGiftMenuItems } from "@/components/gift/useGiftMenuItems";
import { ActionMenu, Button, Card, Chip, EmptyState, Icon, Input, Overline } from "@/components/ui";
import { useGroupId } from "@/lib/auth";
import { birthdayYearForPerson } from "@/lib/birthdays";
import { cn } from "@/lib/cn";
import { useMyId, useStore } from "@/lib/hooks";
import { isIdentitySkipped } from "@/lib/identity";
import { formatEuro } from "@/lib/money";
import { isSkipped } from "@/lib/stack";
import { addGift } from "@/lib/storage";
import { useNow } from "@/lib/useNow";
import type { Gift, Person } from "@/lib/types";

// ── PersonDetail → Tab „Geschenke“ ────────────────────────────
// `isMe` (eigene Person): laufende Geschenke nur als „Überraschung in
// Planung“ ohne Zahlen, Status und Menü; kein „Neues Geschenk anlegen“.
// Sonst ⋯ je Geschenk: Diesmal aussetzen / Wieder aufnehmen / Löschen.
// Ohne Identität (und ohne „nur ansehen“) erst „Wer bist du?“ – es könnte
// die beschenkte Person selbst sein.
export function GiftsTab({ person, stack, past, isMe }: { person: Person; stack: Gift[]; past: Gift[]; isMe: boolean }) {
  const myId = useMyId();
  const groupId = useGroupId();
  if (!myId && !isIdentitySkipped(groupId)) return <IdentityFirst person={person} />;
  return <GiftsList person={person} stack={stack} past={past} isMe={isMe} />;
}

function IdentityFirst({ person }: { person: Person }) {
  const { open } = useIdentityPrompt();
  return (
    <Card className="p-4">
      <h2 className="m-0 mb-1 text-body font-bold text-fg">Wer bist du?</h2>
      <p className="m-0 mb-3 text-meta text-fg-muted">
        Damit wir dir nichts verraten, zeigen wir die Geschenke für {person.name} erst, wenn du dich ausgewählt hast.
      </p>
      <Button className="w-full" aria-haspopup="dialog" onClick={() => void open({ recipientId: person.id })}>
        Ich wähle mich aus
      </Button>
    </Card>
  );
}

function GiftsList({ person, stack, past, isMe }: { person: Person; stack: Gift[]; past: Gift[]; isMe: boolean }) {
  const nav = useNavigate();
  const { settings } = useStore();
  const menuItems = useGiftMenuItems();
  const now = useNow(60_000);
  const all = [...stack, ...past];

  const [newGiftOpen, setNewGiftOpen] = useState(false);
  const [newGiftYear, setNewGiftYear] = useState(birthdayYearForPerson(person));
  const [newGiftOccasion, setNewGiftOccasion] = useState("Geburtstag");
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDate, setCustomDate] = useState("");

  function createGift() {
    const occ = newGiftOccasion.trim() || "Geburtstag";
    const finalDate = useCustomDate && customDate ? customDate : undefined;
    // Carry over the last gift's group-chat link for the same person+occasion
    const lastSameKind = [...stack, ...past]
      .filter((g) => (g.occasion ?? "Geburtstag") === occ)
      .sort((a, b) => b.enteredStackAt - a.enteredStackAt)[0];
    addGift({
      personId: person.id,
      year: finalDate ? +finalDate.slice(0, 4) || newGiftYear : newGiftYear,
      status: "open",
      budgetPerPerson: settings.defaultBudget,
      manuallyAdded: true,
      occasion: occ,
      customDate: finalDate,
      whatsappLink: lastSameKind?.whatsappLink,
    });
    toast.success(`Geschenk angelegt`);
    setNewGiftOpen(false);
    setNewGiftOccasion("Geburtstag");
    setUseCustomDate(false);
    setCustomDate("");
  }

  const byYear: Record<number, Gift[]> = {};
  all.forEach((g) => {
    (byYear[g.year] ||= []).push(g);
  });
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  return (
    <div>
      {all.length === 0 ? (
        <EmptyState
          emoji="🎁"
          title="Noch kein Geschenk hier"
          subtitle={isMe ? "Geschenke für dich legen deine Freunde an." : `Lege ein neues Geschenk für ${person.name} an.`}
        />
      ) : (
        years.map((y) => (
          <div key={y} className="mb-4">
            <Overline className="mb-2 pl-1">{y}</Overline>
            <div className="flex flex-col gap-2">
              {byYear[y].map((g) => {
                // Spoiler-Schutz: eigene laufende Geschenke ohne Details.
                const secret = isMe && g.status !== "received";
                const skipped = isSkipped(g);
                const active = g.status !== "received" && !skipped;
                const items = secret ? [] : menuItems(g, person, now);
                return (
                  <div
                    key={g.id}
                    className="flex items-center gap-1 rounded-card border border-line-subtle bg-surface py-1 pl-3.5 pr-1 shadow-card"
                  >
                    <button
                      type="button"
                      onClick={() => nav(`/gift/${g.id}`)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-tile",
                          active ? "bg-grad-hero text-white" : "bg-surface-2 text-fg-muted",
                        )}
                      >
                        <Icon.gift />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-fg">
                          {g.occasion ?? "Geburtstag"} {y}
                        </span>
                        <span className="mt-0.5 block text-xs text-fg-muted">
                          {secret
                            ? "🤫 Überraschung in Planung"
                            : skipped
                              ? "Diesmal ausgesetzt"
                              : g.status !== "received"
                                ? `${g.participantIds.length} Personen · ${formatEuro(g.participantIds.length * g.budgetPerPerson)}`
                                : "erhalten"}
                        </span>
                      </span>
                      {secret ? (
                        <SurpriseBadge label="für dich" />
                      ) : skipped ? (
                        <Chip variant="neutral">ausgesetzt</Chip>
                      ) : (
                        <Chip variant={g.status === "open" ? "info" : g.status === "confirmed" ? "accent" : "success"}>
                          {g.status === "open" ? "offen" : g.status === "confirmed" ? "bestätigt" : "erhalten"}
                        </Chip>
                      )}
                    </button>
                    {items.length > 0 ? (
                      <ActionMenu items={items} label={`Mehr zu ${g.occasion ?? "Geburtstag"} ${y}`} title={`Geschenk ${y} für ${person.name}`} />
                    ) : (
                      <span aria-hidden className="w-2" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {isMe ? (
        all.length > 0 && <p className="m-0 mt-1 px-1 text-meta text-fg-muted">Geschenke für dich legen deine Freunde an.</p>
      ) : !newGiftOpen ? (
        <Button
          variant="secondary"
          onClick={() => {
            setNewGiftYear(birthdayYearForPerson(person));
            setNewGiftOpen(true);
          }}
          className="mt-1 w-full"
        >
          <Icon.plus /> Neues Geschenk anlegen
        </Button>
      ) : (
        <div className="mt-1 space-y-2.5 rounded-card border border-line-subtle bg-surface p-3.5">
          <Input
            label="Anlass"
            type="text"
            value={newGiftOccasion}
            onChange={(e) => setNewGiftOccasion(e.target.value)}
            placeholder="z.B. Geburtstag, Reise, Hochzeit"
          />
          <Input
            label="Jahr"
            type="number"
            value={newGiftYear}
            onChange={(e) => setNewGiftYear(parseInt(e.target.value, 10) || newGiftYear)}
            disabled={useCustomDate}
          />
          <label className="flex cursor-pointer select-none items-start gap-3 px-0.5 py-1">
            <input
              type="checkbox"
              checked={useCustomDate}
              onChange={(e) => setUseCustomDate(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <span className="text-sm text-fg-soft">Anderes Datum (statt {person.name}s Geburtstag)</span>
          </label>
          {useCustomDate && <Input label="Datum" type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setNewGiftOpen(false)} className="flex-1">
              Abbrechen
            </Button>
            <Button onClick={createGift} disabled={useCustomDate && !customDate} className="flex-1">
              Anlegen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
