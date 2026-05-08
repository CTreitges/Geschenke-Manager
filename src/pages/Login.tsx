import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Input } from "@/components/ui";
import { sha256, setAuthed } from "@/lib/auth";
import { useStore } from "@/lib/hooks";
import { updateSettings } from "@/lib/storage";
import { toast } from "sonner";

export default function Login() {
  const { settings } = useStore();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  // First-time setup: no password set yet → use first input as the password
  const firstTime = !settings.passwordHash;

  useEffect(() => {
    document.title = "Geschenke-Manager — Login";
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pw) return;
    setBusy(true);
    try {
      const hash = await sha256(pw);
      if (firstTime) {
        updateSettings({ passwordHash: hash });
        setAuthed(true);
        toast.success("Passwort gesetzt — willkommen!");
        nav("/");
        return;
      }
      if (hash === settings.passwordHash) {
        setAuthed(true);
        toast.success("Reingekommen 🎉");
        nav("/");
      } else {
        toast.error("Falsches Passwort");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 dark:from-stone-900 dark:to-stone-950 px-4">
      <Card className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🎁</div>
          <h1 className="text-2xl font-bold tracking-tight">Geschenke-Manager</h1>
          <p className="text-sm text-stone-500 mt-1">
            {firstTime ? "Wähle ein Passwort für die Gruppe" : "Gemeinsames Passwort eingeben"}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Input
            type="password"
            placeholder="Passwort"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
          />
          <Button type="submit" disabled={busy} className="w-full">
            {firstTime ? "Passwort setzen" : "Reinkommen"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
