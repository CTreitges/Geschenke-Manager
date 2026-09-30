import { useState } from "react";
import { toast } from "sonner";
import { Button, Input, Sheet } from "@/components/ui";
import { changePasswordCF } from "@/lib/storage";

/** Gruppen-Passwort ändern (Einstellungen → Gefahrenzone). */
export function PasswordSheet({ open, onClose, groupId }: { open: boolean; onClose: () => void; groupId: string | null }) {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);

  function close() {
    if (busy) return;
    setOldPw("");
    setNewPw("");
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!oldPw || !newPw || !groupId) return;
    setBusy(true);
    try {
      await changePasswordCF(groupId, oldPw, newPw);
      toast.success("Passwort geändert");
      setOldPw("");
      setNewPw("");
      onClose();
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "functions/permission-denied") {
        toast.error("Aktuelles Passwort falsch");
      } else {
        console.error(err);
        toast.error("Passwort ändern fehlgeschlagen");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Passwort ändern"
      description={`Neues Gruppen-Passwort für „${groupId ?? ""}“. Wer schon drin ist, bleibt angemeldet.`}
    >
      <form onSubmit={submit} className="flex flex-col gap-3 pb-1">
        <Input
          label="Aktuelles Passwort"
          type="password"
          autoComplete="current-password"
          value={oldPw}
          onChange={(e) => setOldPw(e.target.value)}
          autoFocus
        />
        <Input
          label="Neues Passwort"
          type="password"
          autoComplete="new-password"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
        />
        <div className="flex gap-2.5 pt-2">
          <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={close} disabled={busy}>
            Abbrechen
          </Button>
          <Button type="submit" size="lg" className="flex-1" loading={busy} disabled={!oldPw || !newPw}>
            Ändern
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
