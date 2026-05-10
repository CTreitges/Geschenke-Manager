import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Icon, Input } from "@/components/ui";
import { addKnownGroup, isAuthed, setAuthed, setGroupId, useKnownGroups } from "@/lib/auth";
import { joinGroupCF, setActiveGroup } from "@/lib/storage";
import { toast } from "sonner";

export default function Login() {
  const [groupIdInput, setGroupIdInput] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const knownGroups = useKnownGroups();
  const showSaved = isAuthed() && knownGroups.length > 0;

  useEffect(() => {
    document.title = "Geschenke-Manager — Login";
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = groupIdInput.trim();
    if (!id || !pw) return;
    setBusy(true);
    try {
      try {
        await joinGroupCF(id, pw);
      } catch (err) {
        const code = (err as { code?: string })?.code ?? "";
        setShake(true);
        setTimeout(() => setShake(false), 400);
        if (code === "functions/not-found") {
          toast.error("Gruppe nicht gefunden");
        } else if (code === "functions/permission-denied") {
          toast.error("Falsches Passwort");
        } else if (code === "functions/unauthenticated") {
          toast.error("Anonyme Anmeldung läuft noch — gleich nochmal");
        } else {
          console.error(err);
          toast.error("Login fehlgeschlagen");
        }
        return;
      }
      addKnownGroup(id);
      setGroupId(id);
      setAuthed(true);
      // Force a fresh subscription cycle in case we were stuck on a
      // permission-denied (e.g. v1→v2 auth bump where the cached groupId
      // points to a group we weren't a member of yet).
      setActiveGroup(id);
      toast.success("Reingekommen 🎉");
      nav("/");
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
          🎁
        </div>
        <h1 className="m-0 text-[26px] font-extrabold tracking-tight text-stone-900 dark:text-stone-50">
          Geschenke-Manager
        </h1>
        <p className="mt-1.5 text-sm leading-[1.5] text-stone-500 dark:text-stone-400">
          Wer bekommt als Nächstes was?<br />Gemeinsam, ohne Chaos.
        </p>
      </div>

      {showSaved && (
        <div className="mb-5">
          <div className="text-[10px] font-bold tracking-[0.05em] uppercase text-stone-400 mb-1.5 pl-1">
            Schon eingeloggt
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
            Oder einer weiteren Gruppe beitreten
          </div>
        </div>
      )}

      <form
        onSubmit={submit}
        className={`flex flex-col gap-3 ${shake ? "animate-shake" : ""}`}
      >
        <div className="relative">
          <div className="absolute left-3 top-3.5 text-stone-400 pointer-events-none">
            <Icon.users />
          </div>
          <Input
            type="text"
            placeholder="Gruppen-ID"
            value={groupIdInput}
            onChange={(e) => setGroupIdInput(e.target.value)}
            className="pl-11"
            autoFocus
            autoComplete="username"
            spellCheck={false}
          />
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
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-2 px-2.5 py-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400"
          >
            {show ? "Verbergen" : "Zeigen"}
          </button>
        </div>
        <Button type="submit" size="lg" disabled={busy || !groupIdInput.trim() || !pw}>
          {busy ? "Prüfe…" : "Reinkommen"}
          <Icon.chev />
        </Button>
      </form>

      <div className="text-center mt-5">
        <Link
          to="/login/new"
          className="text-sm font-semibold text-violet-700 dark:text-violet-300"
        >
          + Neue Gruppe erstellen
        </Link>
      </div>

      <p className="text-center text-xs mt-6 leading-[1.5] text-stone-400 dark:text-stone-500">
        Vertrauensbasis, kein Account.<br />
        Gruppen-ID und Passwort liegen im Familien-Chat 💛
      </p>
    </div>
  );
}
