import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Card, Chip, Confetti, Dialog, EmptyState, FAB, Icon, Button } from "@/components/ui";
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
import { addGift, deleteGift, ensureAutoGift, markReceived } from "@/lib/storage";
import { useIdentity } from "@/lib/auth";
import { toast } from "sonner";
import type { Person } from "@/lib/types";

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
  // Hydration gate is still useful so we only iterate once persons are loaded.
  useEffect(() => {
    if (!personsHydrated) return;
    persons.forEach((p) => {
      if (!isInStackWindow(p)) return;
      const year = birthdayYearForPerson(p);
      ensureAutoGift(p.id, year, settings.defaultBudget);
    });
  }, [persons, settings.defaultBudget, personsHydrated]);
  void giftsHydrated; // gate-only signal, kept for future use

  const stack = useMemo(() => sortStack(gifts, persons), [gifts, persons]);
  const hero = useMemo(() => findHero(persons), [persons]);

  const myId = useIdentity();
  const me = persons.find((p) => p.id === myId);
  const heroDays = hero ? daysUntilBirthday(hero) : 0;

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
          <div
            onClick={() => {
              const sg = stack.find((g) => g.personId === hero.id);
              if (sg) nav(`/gift/${sg.id}`);
              else nav(`/person/${hero.id}`);
            }}
            className="relative overflow-hidden rounded-3xl text-white cursor-pointer"
            style={{
              padding: "20px 20px 22px",
              background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
              boxShadow:
                "0 18px 36px -12px rgba(124,58,237,0.45), inset 0 0 0 1px rgba(255,255,255,0.2)",
            }}
          >
            <Confetti active={heroDays <= 3} />
            <div className="flex items-center gap-2 text-[13px] font-semibold opacity-95">
              <span>🎂</span> Als Nächstes hat Geburtstag …
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
                {heroDays === 0 ? "Heute! 🎉" : heroDays === 1 ? "Morgen" : `in ${heroDays} Tagen`}
              </div>
              <Icon.chev className="opacity-90" />
            </div>
          </div>
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
            return (
              <StackCard
                key={g.id}
                giftId={g.id}
                person={p}
                days={daysUntilBirthday(p)}
                inStackDays={daysAgo(g.enteredStackAt)}
                participants={g.participantIds.length}
                budget={g.participantIds.length * g.budgetPerPerson}
                onOpen={() => nav(`/gift/${g.id}`)}
                onReceive={() => {
                  if (confirm(`Geschenk für ${p.name} als erhalten markieren?`)) {
                    markReceived(g.id);
                    toast.success(`${p.name}: Geschenk erhalten ✓`);
                  }
                }}
                onRemove={() => {
                  if (
                    confirm(
                      `Geschenk für ${p.name} (${g.year}) aus dem Stack entfernen?\n\nAlle Vorschläge + die Abstimmung gehen verloren.`,
                    )
                  ) {
                    deleteGift(g.id);
                    toast.success(`Geschenk entfernt`);
                  }
                }}
              />
            );
          })
        )}
      </div>

      <FAB onClick={() => setAddOpen(true)} />
      <AddManualDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function StackCard({
  person,
  days,
  inStackDays,
  participants,
  budget,
  onOpen,
  onReceive,
  onRemove,
}: {
  giftId: string;
  person: Person;
  days: number;
  inStackDays: number;
  participants: number;
  budget: number;
  onOpen: () => void;
  onReceive: () => void;
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
        <div className="flex gap-1 mt-1">
          <button
            onClick={onReceive}
            aria-label="Geschenk erhalten"
            title="Geschenk erhalten"
            className="w-7 h-7 rounded-full border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 flex items-center justify-center"
          >
            <Icon.check size={14} />
          </button>
          <button
            onClick={onRemove}
            aria-label="Geschenk aus Stack löschen"
            title="Aus Übersicht entfernen"
            className="w-7 h-7 rounded-full border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-red-500 hover:border-red-300 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950 flex items-center justify-center"
          >
            <Icon.trash size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddManualDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { persons, settings } = useStore();
  const [personId, setPersonId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());

  function submit() {
    if (!personId) return;
    const p = persons.find((x) => x.id === personId);
    if (!p) return;
    addGift({
      personId,
      year,
      status: "open",
      budgetPerPerson: settings.defaultBudget,
      manuallyAdded: true,
    });
    toast.success(`${p.name} zum Stack hinzugefügt`);
    setPersonId("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Geschenk manuell hinzufügen">
      <div className="space-y-3">
        <div>
          <label className="block text-[13px] font-semibold text-stone-500 dark:text-stone-400 mb-1.5">
            Person
          </label>
          <select
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className="w-full px-3.5 py-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-[15px]"
          >
            <option value="">— wählen —</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[13px] font-semibold text-stone-500 dark:text-stone-400 mb-1.5">
            Jahr
          </label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(+e.target.value)}
            className="w-full px-3.5 py-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-[15px]"
          />
        </div>
        <div className="flex gap-2 pt-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Abbrechen</Button>
          <Button onClick={submit} disabled={!personId} className="flex-1">Hinzufügen</Button>
        </div>
      </div>
    </Dialog>
  );
}
