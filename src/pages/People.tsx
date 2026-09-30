import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Button, Chip, Dialog, EmptyState, FAB, Input, PageHeader, Segmented } from "@/components/ui";
import { BirthdayPicker } from "@/components/BirthdayPicker";
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
        <Segmented
          label="Sortierung"
          value={sort}
          onChange={setSort}
          options={[
            { value: "birthday", label: "Nächster Geburtstag" },
            { value: "alpha", label: "A–Z" },
          ]}
        />
      </div>

      {sorted.length === 0 ? (
        <div className="px-4">
          <EmptyState
            emoji="👥"
            title="Noch niemand"
            subtitle="Lege die erste Person an."
            action={<Button onClick={() => setOpen(true)}>Person anlegen</Button>}
          />
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
                type="button"
                className="flex min-h-[130px] flex-col items-start gap-2 rounded-card border border-line-subtle bg-surface p-3.5 text-left shadow-card"
              >
                <Avatar person={p} size={40} />
                <div className="flex-1">
                  <div className="text-body font-bold tracking-tight text-fg">
                    {p.name}
                    {p.id === myId && <span className="ml-1 text-2xs font-semibold text-accent-text">· du</span>}
                  </div>
                  <div className="mt-0.5 text-xs font-medium text-fg-muted">
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

      <FAB onClick={() => setOpen(true)} label="Person hinzufügen" />
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
        <BirthdayPicker value={bd} onChange={setBd} />
        <Input label="E-Mail (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {email.trim() && (
          <p className="-mt-1 px-1 text-xs leading-snug text-fg-muted">
            Mit Mail bekommt die Person automatisch eine Erinnerung 60/30/14 Tage vor ihrem Geburtstag, eine Wunschliste zu schreiben. Abbestellen ist in jeder Mail möglich.
          </p>
        )}
        <div className="flex gap-2 pt-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Abbrechen</Button>
          <Button onClick={submit} disabled={!name.trim() || !bd} className="flex-1">Speichern</Button>
        </div>
      </div>
    </Dialog>
  );
}
