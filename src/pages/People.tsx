import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, EmptyState, Input, Modal, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/hooks";
import { addPerson } from "@/lib/storage";
import { daysUntilBirthday, formatBirthday, formatDaysUntil } from "@/lib/birthdays";
import { toast } from "sonner";

export default function People() {
  const { persons } = useStore();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const sorted = [...persons].sort(
    (a, b) => daysUntilBirthday(a) - daysUntilBirthday(b),
  );

  return (
    <>
      <PageHeader
        title="Personen"
        action={
          <Button size="sm" onClick={() => setOpen(true)}>
            + Hinzufügen
          </Button>
        }
      />
      {sorted.length === 0 ? (
        <Card>
          <EmptyState icon="👥" title="Noch niemand" hint="Lege die erste Person an." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sorted.map((p) => (
            <Card key={p.id} onClick={() => nav(`/person/${p.id}`)}>
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-stone-500">
                {formatBirthday(p)} · {formatDaysUntil(daysUntilBirthday(p))}
              </div>
            </Card>
          ))}
        </div>
      )}
      <AddPersonModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AddPersonModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [bd, setBd] = useState("");
  const [email, setEmail] = useState("");

  function submit() {
    if (!name.trim() || !bd) return;
    addPerson({ name: name.trim(), birthday: bd, email: email.trim() || undefined });
    toast.success(`${name.trim()} hinzugefügt`);
    setName("");
    setBd("");
    setEmail("");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Person hinzufügen">
      <div className="space-y-3">
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <Input type="date" value={bd} onChange={(e) => setBd(e.target.value)} />
        <Input
          type="email"
          placeholder="E-Mail (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={!name.trim() || !bd} className="flex-1">
            Speichern
          </Button>
        </div>
      </div>
    </Modal>
  );
}
