import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, EmptyState, Modal, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/hooks";
import {
  daysUntilBirthday,
  findHero,
  formatBirthday,
  formatDaysUntil,
  isInStackWindow,
  birthdayYearForPerson,
  sortStack,
} from "@/lib/birthdays";
import { addGift, reorderGifts, markReceived } from "@/lib/storage";
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

  // Auto-create gifts when persons enter the 30-day window
  useEffect(() => {
    persons.forEach((p) => {
      if (!isInStackWindow(p)) return;
      const year = birthdayYearForPerson(p);
      const exists = gifts.some(
        (g) => g.personId === p.id && g.year === year && g.status === "open",
      );
      if (!exists) {
        addGift({
          personId: p.id,
          year,
          status: "open",
          budgetPerPerson: settings.defaultBudget,
          manuallyAdded: false,
        });
      }
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

  return (
    <>
      <PageHeader title="Übersicht" />

      {hero ? (
        <Card
          className="bg-gradient-to-br from-amber-100 to-orange-200 dark:from-amber-900/40 dark:to-orange-900/40 border-amber-200 dark:border-amber-800/50 mb-6"
          onClick={() => nav(`/person/${hero.id}`)}
        >
          <div className="text-xs uppercase tracking-wide text-amber-800 dark:text-amber-300 font-semibold mb-2">
            🎂 Als Nächstes hat Geburtstag
          </div>
          <div className="text-3xl font-bold">{hero.name}</div>
          <div className="mt-1 text-amber-900 dark:text-amber-200">
            {formatDaysUntil(daysUntilBirthday(hero))} · {formatBirthday(hero)}
          </div>
        </Card>
      ) : (
        <Card className="mb-6">
          <EmptyState
            icon="👋"
            title="Noch keine Personen"
            hint="Lege unter Personen die ersten Freunde an."
          />
        </Card>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">
          Aktueller Stack
          {stack.length > 0 && (
            <Badge tone="primary" className="ml-2">{stack.length}</Badge>
          )}
        </h2>
        <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
          + Manuell
        </Button>
      </div>

      {stack.length === 0 ? (
        <Card>
          <EmptyState
            icon="🎉"
            title="Stack ist leer"
            hint="Es kommen automatisch Personen rein, deren Geburtstag in 30 Tagen ist."
          />
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={stack.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {stack.map((g) => {
                const p = persons.find((x) => x.id === g.personId);
                if (!p) return null;
                return (
                  <SortableStackCard
                    key={g.id}
                    giftId={g.id}
                    name={p.name}
                    bd={formatBirthday(p)}
                    days={daysUntilBirthday(p)}
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
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AddManualModal open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

function SortableStackCard({
  giftId,
  name,
  bd,
  days,
  participants,
  budget,
  onOpen,
  onReceive,
}: {
  giftId: string;
  name: string;
  bd: string;
  days: number;
  participants: number;
  budget: number;
  onOpen: () => void;
  onReceive: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: giftId,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <div className="flex items-center gap-3">
          <button
            {...attributes}
            {...listeners}
            className="touch-none cursor-grab active:cursor-grabbing text-stone-400 hover:text-stone-600 px-1 -ml-1"
            aria-label="Verschieben"
          >
            ⠿
          </button>
          <button onClick={onOpen} className="flex-1 text-left min-w-0">
            <div className="font-semibold truncate">{name}</div>
            <div className="text-sm text-stone-500 truncate">
              {bd} · {formatDaysUntil(days)}
            </div>
          </button>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex gap-1.5">
              <Badge tone="neutral">{participants} 👥</Badge>
              <Badge tone="primary">{budget} €</Badge>
            </div>
            <button
              onClick={onReceive}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            >
              ✓ erhalten
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function AddManualModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
    <Modal open={open} onClose={onClose} title="Geschenk manuell hinzufügen">
      <div className="space-y-3">
        <label className="block text-sm font-medium">Person</label>
        <select
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
          className="h-11 w-full rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4"
        >
          <option value="">— wählen —</option>
          {persons.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="block text-sm font-medium mt-3">Jahr</label>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(+e.target.value)}
          className="h-11 w-full rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4"
        />
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={!personId} className="flex-1">
            Hinzufügen
          </Button>
        </div>
      </div>
    </Modal>
  );
}
