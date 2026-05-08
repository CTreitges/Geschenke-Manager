import { useEffect, useMemo, useRef, useState } from "react";
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
import { addGift, markReceived, reorderGifts } from "@/lib/storage";
import { useIdentity } from "@/lib/auth";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

export default function Home() {
  const { persons, gifts, settings } = useStore();
  const nav = useNavigate();
  const [addOpen, setAddOpen] = useState(false);

  // Auto-create gifts when persons enter the 30-day window.
  // In-flight tracking prevents the race where the effect runs twice
  // before the first addGift() write round-trips through Firestore's
  // snapshot — which previously caused duplicate stack entries.
  const inFlight = useRef<Set<string>>(new Set());
  useEffect(() => {
    persons.forEach((p) => {
      if (!isInStackWindow(p)) return;
      const year = birthdayYearForPerson(p);
      const key = `${p.id}:${year}`;
      const exists = gifts.some(
        (g) => g.personId === p.id && g.year === year && g.status === "open",
      );
      if (exists) {
        inFlight.current.delete(key);
        return;
      }
      if (inFlight.current.has(key)) return;
      inFlight.current.add(key);
      addGift({
        personId: p.id,
        year,
        status: "open",
        budgetPerPerson: settings.defaultBudget,
        manuallyAdded: false,
      });
    });
  }, [persons, gifts, settings.defaultBudget]);

  const stack = useMemo(() => sortStack(gifts), [gifts]);
  const hero = useMemo(() => findHero(persons), [persons]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = stack.findIndex((g) => g.id === active.id);
    const newIdx = stack.findIndex((g) => g.id === over.id);
    const reordered = arrayMove(stack, oldIdx, newIdx);
    reorderGifts(reordered.map((g) => g.id));
  }

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
            Aktueller Stack
          </h2>
          <Chip variant="accent">{stack.length}</Chip>
        </div>
        <span className="text-xs text-stone-400 font-medium">ältest. oben</span>
      </div>

      {/* Stack */}
      <div className="px-4 pb-24 flex flex-col gap-2.5">
        {stack.length === 0 ? (
          <Card>
            <EmptyState emoji="🎉" title="Stack ist leer" subtitle="Personen erscheinen automatisch 30 Tage vor ihrem Geburtstag." />
          </Card>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={stack.map((g) => g.id)} strategy={verticalListSortingStrategy}>
              {stack.map((g) => {
                const p = persons.find((x) => x.id === g.personId);
                if (!p) return null;
                return (
                  <SortableStackCard
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
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <FAB onClick={() => setAddOpen(true)} />
      <AddManualDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function SortableStackCard({
  giftId,
  person,
  days,
  inStackDays,
  participants,
  budget,
  onOpen,
  onReceive,
}: {
  giftId: string;
  person: import("@/lib/types").Person;
  days: number;
  inStackDays: number;
  participants: number;
  budget: number;
  onOpen: () => void;
  onReceive: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: giftId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const isUrgent = days <= 7;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className="flex items-center gap-2.5 pl-2 pr-3.5 py-3.5 bg-white dark:bg-stone-800 rounded-[18px] border border-[#F0EBE6] dark:border-[#3A3633] shadow-[0_1px_2px_rgba(28,25,23,0.04)]"
      >
        <button
          {...attributes}
          {...listeners}
          aria-label="Verschieben"
          className="touch-none cursor-grab active:cursor-grabbing text-stone-400 dark:text-stone-600 px-0.5 py-1"
        >
          <Icon.drag />
        </button>
        <Avatar person={person} size={42} />
        <button onClick={onOpen} className="flex-1 min-w-0 text-left">
          <div className="text-base font-bold text-stone-900 dark:text-stone-50 tracking-tight truncate">
            {person.name}{" "}
            <span className="text-stone-400 font-medium">· {formatBirthday(person)}</span>
          </div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 flex gap-2 items-center">
            <span
              className={isUrgent ? "font-semibold" : "font-medium"}
              style={{ color: isUrgent ? "var(--gm-urgent, #5B21B6)" : undefined }}
            >
              {days === 0 ? "🎂 heute!" : `in ${days} T.`}
            </span>
            <span className="opacity-50">·</span>
            <span>seit {inStackDays} T. im Stack</span>
          </div>
        </button>
        <div className="flex flex-col gap-1 items-end">
          <Chip variant="neutral">
            <Icon.users size={12} className="-mr-px" />
            {participants}
          </Chip>
          <Chip variant="accent">{budget} €</Chip>
          <button
            onClick={onReceive}
            className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-semibold mt-0.5"
          >
            ✓ erhalten
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
