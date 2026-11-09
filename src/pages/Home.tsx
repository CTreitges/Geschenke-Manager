import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Archive } from "lucide-react";
import { ActionMenu, Avatar, Button, Card, Confetti, Dialog, EmptyState, FAB, Icon, Input, Overline, Section } from "@/components/ui";
import { useIdentityPrompt } from "@/components/IdentitySheet";
import { SurpriseStackCard } from "@/components/surprise/SurpriseStackCard";
import { useGiftMenuItems } from "@/components/gift/useGiftMenuItems";
import { useMyId, useStore } from "@/lib/hooks";
import { formatEuro } from "@/lib/money";
import {
  ageOnNextBirthday,
  birthdayYearForPerson,
  daysUntilBirthday,
  daysUntilForGift,
  findHero,
  formatBirthday,
  formatDaysShort,
  formatShortDate,
  formatTodayHeader,
  giftDate,
  isInStackWindow,
  sortStack,
} from "@/lib/birthdays";
import { withLiveParticipants } from "@/lib/cascade";
import { cn } from "@/lib/cn";
import { giftPhase, type GiftPhase, type GiftPhaseInfo } from "@/lib/giftPhase";
import { useGroupId } from "@/lib/auth";
import { isIdentitySkipped } from "@/lib/identity";
import { markIdentityAsked } from "@/lib/onboarding";
import { addGift, deduplicateOpenGifts, ensureAutoGift } from "@/lib/storage";
import { isRecipient } from "@/lib/spoiler";
import { useNow } from "@/lib/useNow";
import { toast } from "sonner";
import type { Gift, Person } from "@/lib/types";

export default function Home() {
  const store = useStore();
  const { persons, gifts, polls, suggestions, settings, giftsHydrated, personsHydrated } = store;
  const nav = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const now = useNow(60_000);
  const menuItems = useGiftMenuItems();

  // Auto-create gifts when persons enter the 30-day window.
  // Uses ensureAutoGift() which writes to a deterministic doc id
  // (`${personId}_${year}`) — this makes the "does a gift already exist?"
  // check an atomic Firestore-side getDoc() instead of relying on the
  // local-snapshot cache, which previously produced duplicates on
  // every reload due to the cache-vs-server snapshot race.
  // Ausgesetzte Geschenke („Diesmal aussetzen“) bleiben als Dokument bestehen,
  // deshalb entsteht für dieses Jahr kein neues.
  useEffect(() => {
    if (!personsHydrated) return;
    persons.forEach((p) => {
      if (!isInStackWindow(p)) return;
      const year = birthdayYearForPerson(p);
      ensureAutoGift(p.id, year, settings.defaultBudget);
    });
  }, [persons, settings.defaultBudget, personsHydrated]);

  // Defense-in-depth: clean up duplicates once per app mount. Catches
  // entries created by older cached bundles still running the legacy
  // random-id path on other devices.
  useEffect(() => {
    if (!giftsHydrated || !personsHydrated) return;
    deduplicateOpenGifts().then((n) => {
      if (n > 0) console.log(`[gm] cleaned up ${n} duplicate gift(s)`);
    });
  }, [giftsHydrated, personsHydrated]);

  const myId = useMyId();
  const groupId = useGroupId();
  const identity = useIdentityPrompt();
  // Ohne Identität könnte die beschenkte Person zuschauen: neutrale Karten ohne
  // Phase, Beträge und Teilnehmer – außer nach bewusstem „nur ansehen“.
  const neutral = !myId && !isIdentitySkipped(groupId);

  // Gezählt wird nur, wer noch existiert (verwaiste Teilnehmer aus Altbeständen).
  // Die eigene Karte bleibt auch ausgesetzt stehen (verrät sonst die Entscheidung).
  const stack = useMemo(() => {
    const ids = new Set(persons.map((p) => p.id));
    return sortStack(gifts, persons, myId).map((g) => withLiveParticipants(g, ids));
  }, [gifts, persons, myId]);
  const hero = useMemo(() => findHero(persons), [persons]);

  const me = persons.find((p) => p.id === myId);
  const heroDays = hero ? daysUntilBirthday(hero) : 0;
  // Spoiler-Schutz: Habe ich selbst als Nächstes Geburtstag, führt der Hero zur Wunschliste.
  const heroIsMe = !!hero && hero.id === myId;
  const heroDaysText = heroDays === 0 ? "Heute! 🎉" : heroDays === 1 ? "Morgen" : `in ${heroDays} Tagen`;

  return (
    <div className="pb-16">
      {/* Greeting */}
      <div className="px-5 pt-4 pb-2">
        <Overline>{formatTodayHeader()}</Overline>
        <h1 className="m-0 mt-0.5 text-title font-extrabold tracking-tight text-fg">
          Hallo{me ? `, ${me.name}` : ""} <span aria-hidden>👋</span>
        </h1>
      </div>

      {neutral && persons.length > 0 && (
        <IdentityBanner onPick={() => void identity.open({ onLater: markIdentityAsked })} />
      )}

      {/* Hero card */}
      {hero && (
        <div className="px-4 pt-1 pb-4">
          <button
            type="button"
            onClick={() => {
              if (heroIsMe) return nav("/wishlist");
              const sg = stack.find((g) => g.personId === hero.id);
              if (sg) nav(`/gift/${sg.id}`);
              else nav(`/person/${hero.id}`);
            }}
            className="relative block w-full overflow-hidden rounded-sheet bg-grad-hero px-5 pb-[22px] pt-5 text-left text-white"
            style={{ boxShadow: "0 18px 36px -12px rgba(124,58,237,0.45), inset 0 0 0 1px rgba(255,255,255,0.2)" }}
          >
            <Confetti active={heroDays <= 3} />
            <div className="flex items-center gap-2 text-meta font-semibold opacity-95">
              <span aria-hidden>🎂</span> {heroIsMe ? "Als Nächstes hast du Geburtstag!" : "Als Nächstes hat Geburtstag …"}
            </div>
            <div className="mt-3 flex items-end gap-3.5">
              {/* weißer Ring, damit der Avatar nicht im Verlauf verschwindet */}
              <span className="rounded-full ring-2 ring-white/80">
                <Avatar person={hero} size={56} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 truncate text-display font-extrabold leading-none tracking-tight">{hero.name}</div>
                <div className="text-meta font-medium opacity-95">
                  {formatBirthday(hero)}
                  {ageOnNextBirthday(hero) && ` · wird ${ageOnNextBirthday(hero)}`}
                </div>
              </div>
            </div>
            <div className="mt-3.5 flex items-center justify-between rounded-card bg-white/20 px-3.5 py-2.5 backdrop-blur">
              <div className="text-title font-extrabold tracking-tight">
                {heroDaysText}
                {heroIsMe && <span className="ml-1.5 text-sm font-semibold opacity-95">· Wunschliste pflegen</span>}
              </div>
              <Icon.chev className="opacity-90" />
            </div>
          </button>
        </div>
      )}

      {!hero && (
        <div className="px-4 pb-4">
          <Card>
            <EmptyState
              emoji="👋"
              title="Noch keine Personen"
              subtitle="Leg die ersten Freunde an – sie erscheinen 30 Tage vor ihrem Geburtstag hier."
              action={<Button onClick={() => nav("/people")}>Personen anlegen</Button>}
            />
          </Card>
        </div>
      )}

      <Section title="Aktuelle Übersicht" count={stack.length} hint="nächster oben">
        <div className="flex flex-col gap-2.5">
          {stack.length === 0 ? (
            <Card>
              <EmptyState emoji="🎉" title="Gerade steht nichts an" subtitle="Personen erscheinen automatisch 30 Tage vor ihrem Geburtstag." />
            </Card>
          ) : (
            stack.map((g) => {
              const p = persons.find((x) => x.id === g.personId);
              if (!p) return null;
              if (isRecipient(g, myId)) {
                return <SurpriseStackCard key={g.id} gift={g} person={p} onOpen={() => nav("/wishlist")} />;
              }
              if (neutral) return <NeutralStackCard key={g.id} gift={g} person={p} onOpen={() => nav(`/gift/${g.id}`)} />;
              const info = giftPhase(g, polls.find((x) => x.giftId === g.id), suggestions, myId, now);
              return (
                <StackCard
                  key={g.id}
                  gift={g}
                  person={p}
                  info={info}
                  onOpen={(vote) => nav(`/gift/${g.id}${vote ? "?vote=1" : ""}`)}
                  menu={<ActionMenu items={menuItems(g, p, now)} label={`Mehr zu ${p.name}`} title={`Geschenk für ${p.name}`} />}
                />
              );
            })
          )}
        </div>
      </Section>

      <div className="px-4">
        <PastGiftsLink count={gifts.filter((g) => g.status === "received").length} />
      </div>

      <FAB onClick={() => setAddOpen(true)} label="Geschenk hinzufügen" text="Geschenk" />
      <AddManualDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

/** Ohne Identität: Bitte um „Wer bist du?“ statt Details (Spoiler-Schutz). */
function IdentityBanner({ onPick }: { onPick: () => void }) {
  return (
    <div className="px-4 pb-4">
      <div className="rounded-card border border-accent/30 bg-accent-soft px-3.5 py-3">
        <h2 className="m-0 text-body font-bold text-fg">
          <span aria-hidden>👋 </span>Wer bist du?
        </h2>
        <p className="m-0 mt-0.5 text-meta text-fg-soft">
          Damit wir dir nichts verraten, zeigen wir Ideen, Stand und Beträge erst, wenn du dich ausgewählt hast.
        </p>
        <Button size="sm" className="mt-2.5" aria-haspopup="dialog" onClick={onPick}>
          Ich wähle mich aus
        </Button>
      </div>
    </div>
  );
}

function PastGiftsLink({ count }: { count: number }) {
  const nav = useNavigate();
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={() => nav("/past")}
      className="flex w-full items-center gap-3 rounded-card border border-line-subtle bg-surface px-3.5 py-3 shadow-card transition-transform active:scale-[0.99]"
    >
      <div aria-hidden className="flex h-9 w-9 items-center justify-center rounded-tile bg-surface-2 text-fg-soft">
        <Archive size={18} />
      </div>
      <div className="flex-1 text-left">
        <div className="text-sm font-bold text-fg">Alte Geschenke</div>
        <div className="text-xs text-fg-muted">
          {count} {count === 1 ? "erhaltenes Geschenk" : "erhaltene Geschenke"} ansehen
        </div>
      </div>
      <Icon.chev className="text-fg-muted" />
    </button>
  );
}

// Farbe der Phasenzeile (immer mit Emoji + Text, nie Farbe allein).
const PHASE_TEXT: Record<GiftPhase, string> = {
  ideas: "text-status-open",
  voting: "text-status-vote",
  result: "text-accent-text",
  decided: "text-status-done",
  received: "text-status-received",
};

/**
 * Stack-Karte: Name · Datum, Frist, Phasenzeile aus giftPhase() und
 * Teilnehmer/Budget. „Du fehlst“ öffnet direkt das VoteSheet (?vote=1).
 * ⋯ = Diesmal aussetzen / Löschen (useGiftMenuItems).
 */
function StackCard({
  gift,
  person,
  info,
  onOpen,
  menu,
}: {
  gift: Gift;
  person: Person;
  info: GiftPhaseInfo;
  onOpen: (vote?: boolean) => void;
  menu: ReactNode;
}) {
  const days = daysUntilForGift(gift, person);
  const date = giftDate(gift, person);
  const occasion = gift.occasion && gift.occasion !== "Geburtstag" ? gift.occasion : null;
  const participants = gift.participantIds.length;
  const badge = info.badge;

  return (
    <div className="relative rounded-card border border-line-subtle bg-surface shadow-card">
      <button type="button" onClick={() => onOpen()} className="flex w-full items-start gap-2.5 pb-2 pl-3 pr-3 pt-3 text-left">
        {/* Initialen nicht mitlesen: der Button-Name beginnt mit dem Namen */}
        <span aria-hidden>
          <Avatar person={person} size={42} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2 pr-10">
            <span className="min-w-0 flex-1 truncate text-base font-bold tracking-tight text-fg">
              {person.name}
              <span className="font-medium text-fg-muted">
                {occasion && ` · ${occasion}`}
                {date && ` · ${formatShortDate(date)}`}
              </span>
            </span>
            <span className={cn("shrink-0 text-xs", days <= 7 ? "font-semibold text-accent-text" : "font-medium text-fg-muted")}>
              {formatDaysShort(days)}
            </span>
          </span>
          <span className={cn("mt-1 block truncate text-meta font-semibold", PHASE_TEXT[info.phase])}>{info.label}</span>
        </span>
      </button>
      <div className="absolute right-0.5 top-0.5">{menu}</div>
      {/* Teilnehmer/Budget und ggf. Badge in einer Zeile unter dem Text (Badge ist ein eigener Knopf) */}
      <div className="flex min-h-7 items-center justify-between gap-2 pb-2.5 pl-16 pr-2.5">
        <span className="flex items-center gap-1 text-xs text-fg-muted">
          <Icon.users size={12} />
          <span className="sr-only">Teilnehmer:</span>
          {participants} · {formatEuro(participants * gift.budgetPerPerson)}
        </span>
        {badge && (
          <button
            type="button"
            onClick={() => onOpen(badge === "du-fehlst")}
            className={cn(
              "-my-1 inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold",
              badge === "du-fehlst" ? "bg-status-vote-soft text-status-vote" : "bg-accent-soft text-accent-text",
            )}
          >
            {badge === "du-fehlst" ? (
              <>
                <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-status-vote" />
                Du fehlst
                <span className="sr-only"> – jetzt abstimmen</span>
              </>
            ) : (
              "Bezahlung offen"
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/** Stack-Karte ohne Identität: nur Name, Anlass, Datum und Countdown – keine Phase, kein Betrag, kein Menü. */
function NeutralStackCard({ gift, person, onOpen }: { gift: Gift; person: Person; onOpen: () => void }) {
  const days = daysUntilForGift(gift, person);
  const date = giftDate(gift, person);
  const occasion = gift.occasion && gift.occasion !== "Geburtstag" ? gift.occasion : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2.5 rounded-card border border-line-subtle bg-surface p-3 text-left shadow-card active:scale-[0.99]"
    >
      <span aria-hidden>
        <Avatar person={person} size={42} />
      </span>
      <span className="min-w-0 flex-1 truncate text-base font-bold tracking-tight text-fg">
        {person.name}
        <span className="font-medium text-fg-muted">
          {occasion && ` · ${occasion}`}
          {date && ` · ${formatShortDate(date)}`}
        </span>
      </span>
      <span className={cn("shrink-0 text-xs", days <= 7 ? "font-semibold text-accent-text" : "font-medium text-fg-muted")}>
        {formatDaysShort(days)}
      </span>
      <Icon.chev className="shrink-0 text-fg-muted" />
    </button>
  );
}

function AddManualDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { persons: allPersons, settings, gifts } = useStore();
  const myId = useMyId();
  // Geschenke für mich legen die anderen an (Spoiler-Schutz).
  const persons = allPersons.filter((p) => p.id !== myId);
  const [personId, setPersonId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [occasion, setOccasion] = useState("Geburtstag");
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDate, setCustomDate] = useState("");

  function submit() {
    if (!personId) return;
    const p = persons.find((x) => x.id === personId);
    if (!p) return;
    const occ = occasion.trim() || "Geburtstag";
    const finalDate = useCustomDate && customDate ? customDate : undefined;
    // Carry over the last gift's group-chat link for the same person+occasion
    const lastSameKind = [...gifts]
      .filter((g) => g.personId === personId && (g.occasion ?? "Geburtstag") === occ)
      .sort((a, b) => b.enteredStackAt - a.enteredStackAt)[0];
    addGift({
      personId,
      year: finalDate ? +finalDate.slice(0, 4) || year : year,
      status: "open",
      budgetPerPerson: settings.defaultBudget,
      manuallyAdded: true,
      occasion: occ,
      customDate: finalDate,
      whatsappLink: lastSameKind?.whatsappLink,
    });
    toast.success(`${p.name} zur Übersicht hinzugefügt`);
    setPersonId("");
    setOccasion("Geburtstag");
    setUseCustomDate(false);
    setCustomDate("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Geschenk manuell hinzufügen">
      <div className="space-y-3 pb-2">
        <div>
          <label htmlFor="manual-person" className="mb-1.5 block pl-0.5 text-meta font-semibold text-fg-muted">
            Person
          </label>
          <select
            id="manual-person"
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className="w-full rounded-xl border border-line-control bg-surface px-3.5 py-3 text-fg"
          >
            <option value="">— wählen —</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Anlass"
          type="text"
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          placeholder="z.B. Geburtstag, Reise, Hochzeit"
        />
        <Input
          label="Jahr"
          type="number"
          value={year}
          onChange={(e) => setYear(+e.target.value)}
          disabled={useCustomDate}
          className="disabled:opacity-50"
        />
        <label className="flex cursor-pointer select-none items-start gap-3 py-1">
          <input
            type="checkbox"
            checked={useCustomDate}
            onChange={(e) => setUseCustomDate(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-accent"
          />
          <span className="text-sm text-fg-soft">Anderes Datum (statt Geburtstag)</span>
        </label>
        {useCustomDate && <Input label="Datum" type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />}
        <div className="flex gap-2 pt-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={!personId || (useCustomDate && !customDate)} className="flex-1">
            Hinzufügen
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
