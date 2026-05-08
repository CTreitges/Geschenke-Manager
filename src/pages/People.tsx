import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Button, Chip, Dialog, EmptyState, FAB, Input, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/hooks";
import { addPerson } from "@/lib/storage";
import { daysUntilBirthday, formatBirthday } from "@/lib/birthdays";
import { useIdentity } from "@/lib/auth";
import { pickColor } from "@/lib/colors";
import { toast } from "sonner";

export default function People() {
  const { persons } = useStore();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState<"birthday" | "alpha">("birthday");
  const myId = useIdentity();

  const sorted = useMemo(() => {
    const xs = [...persons];
    if (sort === "birthday") xs.sort((a, b) => daysUntilBirthday(a) - daysUntilBirthday(b));
    else xs.sort((a, b) => a.name.localeCompare(b.name, "de"));
    return xs;
  }, [persons, sort]);

  return (
    <>
      <PageHeader title="Personen" subtitle={`${persons.length} im Freundeskreis`} />

      <div className="px-4 pb-3">
        <div className="p-1 rounded-xl bg-[#F5F1ED] dark:bg-stone-800 flex gap-0.5">
          {[
            { k: "birthday", l: "Nächster Geburtstag" },
            { k: "alpha", l: "A–Z" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setSort(t.k as "birthday" | "alpha")}
              className={`flex-1 py-1.5 rounded-lg text-[13px] font-semibold ${
                sort === t.k
                  ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-50 shadow-sm"
                  : "text-stone-500 dark:text-stone-400"
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="px-4">
          <EmptyState emoji="👥" title="Noch niemand" subtitle="Lege die erste Person an." />
        </div>
      ) : (
        <div className="px-4 pb-24 grid grid-cols-2 gap-2.5">
          {sorted.map((p) => {
            const days = daysUntilBirthday(p);
            const isUrgent = days <= 14;
            return (
              <button
                key={p.id}
                onClick={() => nav(`/person/${p.id}`)}
                className="text-left p-3.5 bg-white dark:bg-stone-800 rounded-[18px] border border-[#F0EBE6] dark:border-[#3A3633] flex flex-col items-start gap-2 min-h-[130px]"
              >
                <Avatar person={p} size={40} />
                <div className="flex-1">
                  <div className="text-[15px] font-bold text-stone-900 dark:text-stone-50 tracking-tight">
                    {p.name}
                    {p.id === myId && (
                      <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold ml-1">· du</span>
                    )}
                  </div>
                  <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 font-medium">
                    {formatBirthday(p)}
                  </div>
                </div>
                <Chip variant={isUrgent ? "accent" : "neutral"} className="mt-auto">
                  {days === 0 ? "heute 🎂" : `in ${days} T.`}
                </Chip>
              </button>
            );
          })}
        </div>
      )}

      <FAB onClick={() => setOpen(true)} />
      <AddPersonDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AddPersonDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [bd, setBd] = useState("");
  const [email, setEmail] = useState("");

  function submit() {
    const trimmed = name.trim();
    if (!trimmed || !bd) return;
    addPerson({
      name: trimmed,
      birthday: bd,
      email: email.trim() || undefined,
      color: pickColor(trimmed),
    });
    toast.success(`${trimmed} hinzugefügt`);
    setName("");
    setBd("");
    setEmail("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Person hinzufügen">
      <div className="space-y-3">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <Input label="Geburtstag" type="date" value={bd} onChange={(e) => setBd(e.target.value)} />
        <Input label="E-Mail (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="flex gap-2 pt-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Abbrechen</Button>
          <Button onClick={submit} disabled={!name.trim() || !bd} className="flex-1">Speichern</Button>
        </div>
      </div>
    </Dialog>
  );
}
