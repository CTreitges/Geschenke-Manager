import { useState } from "react";
import { toast } from "sonner";
import { Button, Input, Sheet } from "@/components/ui";
import { deleteGroupCF } from "@/lib/storage";

/**
 * Gruppe endgültig löschen – mit Gruppen-Passwort als Bestätigung.
 * `onDeleted` räumt lokal auf (bekannte Gruppen, Wechsel bzw. Login).
 */
export function DeleteGroupSheet({
  open,
  onClose,
  groupId,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string | null;
  onDeleted: () => void;
}) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  function close() {
    if (busy) return;
    setPw("");
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!groupId || !pw) return;
    setBusy(true);
    try {
      await deleteGroupCF(groupId, pw);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "functions/permission-denied") {
        toast.error("Falsches Passwort");
      } else {
        console.error(err);
        toast.error("Löschen fehlgeschlagen");
      }
      setBusy(false);
      return;
    }
    setBusy(false);
    setPw("");
    toast.success(`Gruppe „${groupId}“ gelöscht`);
    onDeleted();
  }

  return (
    <Sheet open={open} onClose={close} title={`Gruppe „${groupId ?? ""}“ löschen?`}>
      <form onSubmit={submit} className="space-y-3 pb-1">
        <p className="m-0 text-meta leading-relaxed text-fg-soft">
          Das löscht <strong>alle Personen, Geschenke, Ideen, Wunschlisten und Abstimmungen</strong> dieser Gruppe vom
          Server. Andere Mitglieder verlieren ebenfalls den Zugriff. Diese Aktion ist <strong>nicht umkehrbar</strong>.
        </p>
        <p className="m-0 text-xs text-fg-muted">Feedback bleibt erhalten – es ist gruppenübergreifend.</p>
        <Input
          label="Gruppen-Passwort zur Bestätigung"
          type="password"
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2.5 pt-2">
          <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={close} disabled={busy}>
            Abbrechen
          </Button>
          <Button type="submit" variant="danger" size="lg" className="flex-1" loading={busy} disabled={!pw}>
            Endgültig löschen
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
