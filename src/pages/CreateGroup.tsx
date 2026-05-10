import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Icon, Input } from "@/components/ui";
import { addKnownGroup, isAuthed, sha256, setAuthed, setGroupId, useKnownGroups } from "@/lib/auth";
import { createGroup, groupExists } from "@/lib/storage";
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
      if (await groupExists(id)) {
        toast.error("Diese Gruppen-ID ist schon vergeben");
        return;
      }
      const hash = await sha256(pw);
      await createGroup(id, hash);
      addKnownGroup(id);
      setGroupId(id);
      setAuthed(true);
      toast.success(`Gruppe „${id}" erstellt 🎉`);
      nav("/");
    } catch (err) {
      console.error(err);
      toast.error("Erstellen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col justify-center px-6"
      style={{
        background:
          "radial-gradient(120% 60% at 50% 0%, #EDE9FE 0%, var(--gm-bg) 55%)",
      }}
    >
      <div className="text-center mb-7">
        <div
          className="w-[78px] h-[78px] mx-auto mb-4 rounded-3xl flex items-center justify-center text-[38px]"
          style={{
            background: "linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)",
            boxShadow:
              "0 12px 28px -8px rgba(124,58,237,0.5), inset 0 0 0 1px rgba(255,255,255,0.2)",
          }}
        >
          ✨
        </div>
        <h1 className="m-0 text-[26px] font-extrabold tracking-tight text-stone-900 dark:text-stone-50">
          Neue Gruppe
        </h1>
        <p className="mt-1.5 text-sm leading-[1.5] text-stone-500 dark:text-stone-400">
          Wähle eine ID + ein Passwort.<br />
          Beides teilst du danach mit deinen Freunden.
        </p>
      </div>

      {showSaved && (
        <div className="mb-5">
          <div className="text-[10px] font-bold tracking-[0.05em] uppercase text-stone-400 mb-1.5 pl-1">
            Zurück zu deinen Gruppen
          </div>
          <div className="rounded-2xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 overflow-hidden">
            {knownGroups.map((g, i) => (
              <button
                key={g}
                onClick={() => {
                  setGroupId(g);
                  nav("/");
                }}
                className={`w-full px-3.5 py-2.5 flex items-center gap-2 hover:bg-stone-50 dark:hover:bg-stone-700/40 ${
                  i > 0 ? "border-t border-stone-100 dark:border-stone-700" : ""
                }`}
              >
                <Icon.users size={14} className="text-stone-400" />
                <span className="flex-1 text-left text-sm font-semibold text-stone-900 dark:text-stone-50">
                  {g}
                </span>
                <Icon.chev size={14} className="text-stone-400" />
              </button>
            ))}
          </div>
          <div className="text-[10px] font-bold tracking-[0.05em] uppercase text-stone-400 mt-4 mb-1.5 pl-1">
            Oder eine neue Gruppe anlegen
          </div>
        </div>
      )}

      {/* TODO: paywall / voucher gate hook goes here — gate the form below
          on a successful payment or voucher redemption. For now: open. */}

      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <div className="relative">
            <div className="absolute left-3 top-3.5 text-stone-400 pointer-events-none">
              <Icon.users />
            </div>
            <Input
              type="text"
              placeholder="Gruppen-ID (z. B. familie-mueller)"
              value={groupIdInput}
              onChange={(e) => setGroupIdInput(e.target.value)}
              className="pl-11"
              autoFocus
              spellCheck={false}
            />
          </div>
          <div className="text-[11px] text-stone-400 mt-1.5 pl-1">
            3–30 Zeichen · a–z, A–Z, 0–9, Bindestrich. Erstes Zeichen kein Bindestrich.
          </div>
        </div>

        <div className="relative">
          <div className="absolute left-3 top-3.5 text-stone-400 pointer-events-none">
            <Icon.lock />
          </div>
          <Input
            type={show ? "text" : "password"}
            placeholder="Passwort"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="pl-11 pr-20"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-2 px-2.5 py-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400"
          >
            {show ? "Verbergen" : "Zeigen"}
          </button>
        </div>

        <div className="relative">
          <div className="absolute left-3 top-3.5 text-stone-400 pointer-events-none">
            <Icon.lock />
          </div>
          <Input
            type={show ? "text" : "password"}
            placeholder="Passwort wiederholen"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            className="pl-11"
            autoComplete="new-password"
          />
        </div>

        {pw && pw2 && !pwMatches && (
          <div className="text-xs text-red-600 dark:text-red-400 pl-1">
            Passwörter stimmen nicht überein
          </div>
        )}

        <Button type="submit" size="lg" disabled={!canSubmit}>
          {busy ? "Erstelle…" : "Gruppe anlegen"}
          <Icon.chev />
        </Button>
      </form>

      <div className="text-center mt-5">
        <Link
          to="/login"
          className="text-sm font-semibold text-violet-700 dark:text-violet-300"
        >
          ← Zurück zum Login
        </Link>
      </div>

      <p className="text-center text-xs mt-6 leading-[1.5] text-stone-400 dark:text-stone-500">
        Vertrauensbasis, kein Account.<br />
        Jeder mit ID + Passwort hat vollen Zugriff.
      </p>
    </div>
  );
}
