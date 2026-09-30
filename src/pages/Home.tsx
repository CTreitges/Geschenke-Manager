import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Card, Chip, Confetti, Dialog, EmptyState, FAB, Icon, Button, useConfirm } from "@/components/ui";
import { SurpriseStackCard } from "@/components/surprise/SurpriseStackCard";
import { useStore } from "@/lib/hooks";
import {
  ageOnNextBirthday,
  birthdayYearForPerson,
  daysAgo,
  daysUntilBirthday,
  findHero,
  formatBirthday,
  formatTodayHeader,
  isInStackWindow,
  sortStack,
} from "@/lib/birthdays";
import { addGift, deduplicateOpenGifts, deleteGift, ensureAutoGift } from "@/lib/storage";
import { useIdentity } from "@/lib/auth";
import { isRecipient } from "@/lib/spoiler";
import { toast } from "sonner";
import type { Gift, Person } from "@/lib/types";

export default function Home() {
  const store = useStore();
  const { persons, gifts, settings, giftsHydrated, personsHydrated } = store;
  const nav = useNavigate();
  const [addOpen, setAddOpen] = useState(false);

  // Auto-create gifts when persons enter the 30-day window.
  // Uses ensureAutoGift() which writes to a deterministic doc id
  // (`${personId}_${year}`) — this makes the "does a gift already exist?"
  // check an atomic Firestore-side getDoc() instead of relying on the
  // local-snapshot cache, which previously produced duplicates on
  // every reload due to the cache-vs-server snapshot race.
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

  const stack = useMemo(() => sortStack(gifts, persons), [gifts, persons]);
  const hero = useMemo(() => findHero(persons), [persons]);

  const myId = useIdentity();
  const me = persons.find((p) => p.id === myId);
  const heroDays = hero ? daysUntilBirthday(hero) : 0;
  // Spoiler-Schutz: Habe ich selbst als Nächstes Geburtstag, führt der Hero zur Wunschliste.
  const heroIsMe = !!hero && hero.id === myId;
  const heroDaysText = heroDays === 0 ? "Heute! 🎉" : heroDays === 1 ? "Morgen" : `in ${heroDays} Tagen`;
  const confirm = useConfirm();

  async function removeGift(g: Gift, p: Person) {
    const ok = await confirm({
      title: `Geschenk für ${p.name} (${g.year}) entfernen?`,
      body: "Alle Ideen und die Abstimmung gehen verloren.",
      confirmLabel: "Entfernen",
      tone: "danger",
    });
    if (!ok) return;
    deleteGift(g.id)
      .then(() => toast.success("Geschenk entfernt"))
      .catch(() => toast.error("Entfernen hat nicht geklappt – bitte nochmal"));
  }

  return (
    <div>
      {/* Greeting */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-stone-400 tracking-[0.05em] uppercase">
            {formatTodayHeader()}
          </div>
          <h1 className="m-0 mt-0.5 text-[26px] font-extrabold text-stone-900 dark:text-stone-50 tracking-tight">
            Hallo{me ? `, ${me.name}` : ""} 👋
          </h1>
        </div>
      </div>

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
            className="relative block w-full overflow-hidden rounded-3xl text-left text-white cursor-pointer"
            style={{
              padding: "20px 20px 22px",
              background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
              boxShadow:
                "0 18px 36px -12px rgba(124,58,237,0.45), inset 0 0 0 1px rgba(255,255,255,0.2)",
            }}
          >
            <Confetti active={heroDays <= 3} />
            <div className="flex items-center gap-2 text-[13px] font-semibold opacity-95">
              <span>🎂</span> {heroIsMe ? "Als Nächstes hast du Geburtstag!" : "Als Nächstes hat Geburtstag …"}
            </div>
            <div className="flex items-end gap-3.5 mt-3">
              <Avatar person={hero} size={56} />
              <div className="flex-1 min-w-0">
                <div className="text-[32px] font-extrabold leading-none tracking-tight mb-1">
                  {hero.name}
                </div>
                <div className="text-[13px] opacity-95 font-medium">
                  {formatBirthday(hero)}
                  {ageOnNextBirthday(hero) && ` · wird ${ageOnNextBirthday(hero)}`}
                </div>
              </div>
            </div>
            <div
              className="mt-3.5 px-3.5 py-2.5 rounded-2xl flex items-center justify-between"
              style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)" }}
            >
              <div className="text-[22px] font-extrabold tracking-tight">
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
            <EmptyState emoji="👋" title="Noch keine Personen" subtitle="Lege im Personen-Tab die ersten Freunde an." />
          </Card>
        </div>
      )}

      {/* Section header */}
      <div className="px-5 pt-1.5 pb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="m-0 text-[17px] font-bold text-stone-900 dark:text-stone-50 tracking-tight">
            Aktuelle Übersicht
          </h2>
          <Chip variant="accent">{stack.length}</Chip>
        </div>
        <span className="text-xs text-stone-400 font-medium">nächster oben</span>
      </div>

      {/* Stack */}
      <div className="px-4 pb-24 flex flex-col gap-2.5">
        {stack.length === 0 ? (
          <Card>
            <EmptyState emoji="🎉" title="Stack ist leer" subtitle="Personen erscheinen automatisch 30 Tage vor ihrem Geburtstag." />
          </Card>
        ) : (
          stack.map((g) => {
            const p = persons.find((x) => x.id === g.personId);
            if (!p) return null;
            if (isRecipient(g, myId)) {
              return <SurpriseStackCard key={g.id} gift={g} person={p} onOpen={() => nav("/wishlist")} />;
            }
            return (
              <StackCard
                key={g.id}
                giftId={g.id}
                person={p}
                year={g.year}
                days={daysUntilBirthday(p)}
                inStackDays={daysAgo(g.enteredStackAt)}
                participants={g.participantIds.length}
                budget={g.participantIds.length * g.budgetPerPerson}
                onOpen={() => nav(`/gift/${g.id}`)}
                onRemove={() => void removeGift(g, p)}
              />
            );
          })
        )}
      </div>

      <div className="px-4 mt-2">
        <PastGiftsLink count={gifts.filter((g) => g.status === "received").length} />
      </div>

      <FAB onClick={() => setAddOpen(true)} />
      <AddManualDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function PastGiftsLink({ count }: { count: number }) {
  const nav = useNavigate();
  if (count === 0) return null;
  return (
    <button
      onClick={() => nav("/past")}
      className="w-full px-3.5 py-3 rounded-2xl border border-[#F0EBE6] dark:border-[#3A3633] bg-white dark:bg-stone-800 flex items-center gap-3 active:scale-[0.99] transition-transform"
    >
      <div className="w-9 h-9 rounded-[10px] bg-stone-100 dark:bg-stone-700 flex items-center justify-center text-base">
        📦
      </div>
      <div className="flex-1 text-left">
        <div className="text-[14px] font-bold text-stone-900 dark:text-stone-50">
          Alte Geschenke
        </div>
        <div className="text-[12px] text-stone-500 dark:text-stone-400">
          {count} {count === 1 ? "erhaltenes Geschenk" : "erhaltene Geschenke"} ansehen
        </div>
      </div>
      <Icon.chev />
    </button>
  );
}

function StackCard({
  person,
  year,
  days,
  inStackDays,
  participants,
  budget,
  onOpen,
  onRemove,
}: {
  giftId: string;
  person: Person;
  year: number;
  days: number;
  inStackDays: number;
  participants: number;
  budget: number;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const isUrgent = days <= 7;

  return (
    <div className="flex items-center gap-2.5 pl-3 pr-3 py-3.5 bg-white dark:bg-stone-800 rounded-[18px] border border-[#F0EBE6] dark:border-[#3A3633] shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
      <Avatar person={person} size={42} />
      <button onClick={onOpen} className="flex-1 min-w-0 text-left">
        <div className="text-base font-bold text-stone-900 dark:text-stone-50 tracking-tight truncate">
          {person.name}{" "}
          <span className="text-stone-400 font-medium">· {formatBirthday(person)}</span>
          <span className="ml-1.5 text-[10px] font-semibold text-stone-400 tracking-wide">
            {year}
          </span>
        </div>
        <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 flex gap-2 items-center">
          <span
            className={isUrgent ? "font-semibold" : "font-medium"}
            style={{ color: isUrgent ? "#5B21B6" : undefined }}
          >
            {days === 0 ? "🎂 heute!" : `in ${days} T.`}
          </span>
          <span className="opacity-50">·</span>
          <span>seit {inStackDays} T. im Stack</span>
        </div>
      </button>
      <div className="flex flex-col gap-1 items-end">
        <div className="flex gap-1">
          <Chip variant="neutral">
            <Icon.users size={12} className="-mr-px" />
            {participants}
          </Chip>
          <Chip variant="accent">{budget} €</Chip>
        </div>
        <button
          onClick={onRemove}
          aria-label="Geschenk aus Stack löschen"
          title="Aus Übersicht entfernen"
          className="mt-1 w-7 h-7 rounded-full border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-red-500 hover:border-red-300 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950 flex items-center justify-center"
        >
          <Icon.trash size={14} />
        </button>
      </div>
    </div>
  );
}

function AddManualDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { persons: allPersons, settings, gifts } = useStore();
  const myId = useIdentity();
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
    toast.success(`${p.name} zum Stack hinzugefügt`);
    setPersonId("");
    setOccasion("Geburtstag");
    setUseCustomDate(false);
    setCustomDate("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Geschenk manuell hinzufügen">
      <div className="space-y-3 px-5 pb-2">
        <div>
          <label className="block text-[13px] font-semibold text-stone-500 dark:text-stone-400 mb-1.5">
            Person
          </label>
          <select
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className="w-full px-3.5 py-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
          >
            <option value="">— wählen —</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[13px] font-semibold text-stone-500 dark:text-stone-400 mb-1.5">
            Anlass
          </label>
          <input
            type="text"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            placeholder="z.B. Geburtstag, Reise, Hochzeit"
            className="w-full px-3.5 py-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
          />
        </div>
        <div>
          <label className="block text-[13px] font-semibold text-stone-500 dark:text-stone-400 mb-1.5">
            Jahr
          </label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(+e.target.value)}
            disabled={useCustomDate}
            className="w-full px-3.5 py-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 disabled:opacity-50"
          />
        </div>
        <label className="flex items-start gap-3 cursor-pointer select-none py-1">
          <input
            type="checkbox"
            checked={useCustomDate}
            onChange={(e) => setUseCustomDate(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-violet-600"
          />
          <span className="text-[14px] text-stone-700 dark:text-stone-200">
            Anderes Datum (statt Geburtstag)
          </span>
        </label>
        {useCustomDate && (
          <div>
            <label className="block text-[13px] font-semibold text-stone-500 dark:text-stone-400 mb-1.5">
              Datum
            </label>
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-full px-3.5 py-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
            />
          </div>
        )}
        <div className="flex gap-2 pt-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Abbrechen</Button>
          <Button
            onClick={submit}
            disabled={!personId || (useCustomDate && !customDate)}
            className="flex-1"
          >
            Hinzufügen
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
