import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Input, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/hooks";
import { updateSettings } from "@/lib/storage";
import { getIdentity, sha256, setAuthed, setIdentity } from "@/lib/auth";
import { toast } from "sonner";

export default function Settings() {
  const { persons, settings } = useStore();
  const nav = useNavigate();
  const [identity, setIdentityState] = useState<string>(getIdentity() ?? "");
  const [budget, setBudget] = useState(settings.defaultBudget);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");

  useEffect(() => {
    setBudget(settings.defaultBudget);
  }, [settings.defaultBudget]);

  function saveIdentity(id: string) {
    setIdentityState(id);
    setIdentity(id || null);
    toast.success(id ? `Du bist ${persons.find((p) => p.id === id)?.name}` : "Identität entfernt");
  }

  function toggleDark() {
    const next = !settings.darkMode;
    updateSettings({ darkMode: next });
    if (next) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }

  async function changePassword() {
    if (!oldPw || !newPw) return;
    const oldHash = await sha256(oldPw);
    if (oldHash !== settings.passwordHash) {
      toast.error("Aktuelles Passwort falsch");
      return;
    }
    const newHash = await sha256(newPw);
    updateSettings({ passwordHash: newHash });
    setOldPw("");
    setNewPw("");
    toast.success("Passwort geändert");
  }

  function logout() {
    setAuthed(false);
    nav("/login");
  }

  return (
    <>
      <PageHeader title="Einstellungen" />

      <Card className="mb-4">
        <h2 className="font-semibold mb-3">Wer bin ich?</h2>
        <p className="text-sm text-stone-500 mb-3">
          Wichtig für Vorschläge und Abstimmungen — wird sichtbar zugeordnet.
        </p>
        <select
          value={identity}
          onChange={(e) => saveIdentity(e.target.value)}
          className="h-11 w-full rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4"
        >
          <option value="">— niemand ausgewählt —</option>
          {persons.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Card>

      <Card className="mb-4">
        <h2 className="font-semibold mb-3">Default-Budget</h2>
        <div className="flex gap-2">
          <Input
            type="number"
            value={budget}
            onChange={(e) => setBudget(+e.target.value)}
          />
          <Button
            onClick={() => {
              updateSettings({ defaultBudget: budget });
              toast.success("Gespeichert");
            }}
          >
            Speichern
          </Button>
        </div>
        <p className="text-xs text-stone-500 mt-2">€ pro Person bei neuen Geschenken.</p>
      </Card>

      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Dark Mode</h2>
            <p className="text-sm text-stone-500">Aktuelle Einstellung folgt diesem Toggle.</p>
          </div>
          <Button variant="secondary" onClick={toggleDark}>
            {settings.darkMode ? "🌙 An" : "☀️ Aus"}
          </Button>
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="font-semibold mb-3">Passwort ändern</h2>
        <div className="space-y-2">
          <Input
            type="password"
            placeholder="Aktuelles Passwort"
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Neues Passwort"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
          />
          <Button onClick={changePassword} disabled={!oldPw || !newPw} className="w-full">
            Ändern
          </Button>
        </div>
      </Card>

      <Card className="mb-4 opacity-60">
        <h2 className="font-semibold mb-1">Mail-Benachrichtigungen</h2>
        <p className="text-sm text-stone-500">Bald verfügbar (Phase 2).</p>
      </Card>

      <Button variant="ghost" onClick={logout} className="w-full">
        Ausloggen
      </Button>
    </>
  );
}
