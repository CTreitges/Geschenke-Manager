import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Icon, Input, Overline } from "@/components/ui";
import { GlowScreen, LogoTile } from "@/components/GlowScreen";
import { addKnownGroup, isAuthed, setAuthed, setGroupId, useKnownGroups } from "@/lib/auth";
import { createGroupCF, setActiveGroup } from "@/lib/storage";
import { toast } from "sonner";

const GROUP_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{2,29}$/;

export default function CreateGroup() {
  const [groupIdInput, setGroupIdInput] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const knownGroups = useKnownGroups();
  const showSaved = isAuthed() && knownGroups.length > 0;

  useEffect(() => {
    document.title = "Geschenke-Manager — Neue Gruppe";
  }, []);

  const idValid = GROUP_ID_PATTERN.test(groupIdInput.trim());
  const pwMatches = pw.length > 0 && pw === pw2;
  const canSubmit = idValid && pwMatches && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const id = groupIdInput.trim();
    setBusy(true);
    try {
      try {
        await createGroupCF(id, pw);
      } catch (err) {
        const code = (err as { code?: string })?.code ?? "";
        if (code === "functions/already-exists") {
          toast.error("Diese Gruppen-ID ist schon vergeben");
        } else if (code === "functions/invalid-argument") {
          toast.error("Ungültige Gruppen-ID oder Passwort");
        } else if (code === "functions/unauthenticated") {
          toast.error("Anonyme Anmeldung läuft noch — gleich nochmal");
        } else {
          console.error(err);
          toast.error("Erstellen fehlgeschlagen");
        }
        return;
      }
      addKnownGroup(id);
      setGroupId(id);
      setAuthed(true);
      setActiveGroup(id);
      toast.success(`Gruppe „${id}" erstellt 🎉`);
      nav("/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlowScreen className="flex flex-col justify-center">
      <div className="mb-7 text-center">
        <LogoTile emoji="✨" />
        <h1 className="m-0 text-title font-extrabold tracking-tight text-fg">Neue Gruppe</h1>
        <p className="mt-1.5 text-sm leading-normal text-fg-muted">
          Wähle eine ID + ein Passwort.
          <br />
          Beides teilst du danach mit deinen Freunden.
        </p>
      </div>

      {showSaved && (
        <div className="mb-5">
          <Overline className="mb-1.5 pl-1">Zurück zu deinen Gruppen</Overline>
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            {knownGroups.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGroupId(g);
                  nav("/");
                }}
                className="flex min-h-12 w-full items-center gap-2 border-t border-line-subtle px-3.5 py-2.5 first:border-t-0 hover:bg-surface-2/60"
              >
                <Icon.users size={14} className="text-fg-muted" />
                <span className="flex-1 text-left text-sm font-semibold text-fg">{g}</span>
                <Icon.chev size={14} className="text-fg-muted" />
              </button>
            ))}
          </div>
          <Overline className="mb-1.5 mt-4 pl-1">Oder eine neue Gruppe anlegen</Overline>
        </div>
      )}

      {/* TODO: paywall / voucher gate hook goes here — gate the form below
          on a successful payment or voucher redemption. For now: open. */}

      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-3.5 text-fg-muted">
              <Icon.users />
            </div>
            <Input
              type="text"
              placeholder="Gruppen-ID (z. B. familie-mueller)"
              aria-label="Gruppen-ID"
              aria-describedby="group-id-rules"
              value={groupIdInput}
              onChange={(e) => setGroupIdInput(e.target.value)}
              className="pl-11"
              autoFocus
              spellCheck={false}
            />
          </div>
          <div id="group-id-rules" className="mt-1.5 pl-1 text-2xs text-fg-muted">
            3–30 Zeichen · a–z, A–Z, 0–9, Bindestrich. Erstes Zeichen kein Bindestrich.
          </div>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute left-3 top-3.5 text-fg-muted">
            <Icon.lock />
          </div>
          <Input
            type={show ? "text" : "password"}
            placeholder="Passwort"
            aria-label="Passwort"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="pl-11 pr-24"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-pressed={show}
            className="absolute right-1 top-1/2 min-h-tap -translate-y-1/2 px-3 text-xs font-semibold text-fg-muted"
          >
            {show ? "Verbergen" : "Zeigen"}
          </button>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute left-3 top-3.5 text-fg-muted">
            <Icon.lock />
          </div>
          <Input
            type={show ? "text" : "password"}
            placeholder="Passwort wiederholen"
            aria-label="Passwort wiederholen"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            className="pl-11"
            autoComplete="new-password"
          />
        </div>

        {pw && pw2 && !pwMatches && (
          <div role="alert" className="pl-1 text-xs text-danger">
            Passwörter stimmen nicht überein
          </div>
        )}

        <Button type="submit" size="lg" disabled={!canSubmit}>
          {busy ? "Erstelle…" : "Gruppe anlegen"}
          <Icon.chev />
        </Button>
      </form>

      <div className="mt-4 text-center">
        <Link to="/login" className="inline-flex min-h-tap items-center px-3 text-sm font-semibold text-accent-text">
          ← Zurück zum Login
        </Link>
      </div>

      <p className="mt-4 text-center text-xs leading-normal text-fg-muted">
        Vertrauensbasis, kein Account.
        <br />
        Jeder mit ID + Passwort hat vollen Zugriff.
      </p>
    </GlowScreen>
  );
}
