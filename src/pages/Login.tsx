import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Icon, Input } from "@/components/ui";
import { addKnownGroup, getGroupId, isAuthed, setAuthed, setGroupId, useKnownGroups } from "@/lib/auth";
import { signInWithGoogle, signOutAndReanon, useFirebaseUser } from "@/lib/firebase";
import { joinGroupCF, listMyGroupsCF, setActiveGroup } from "@/lib/storage";
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
  const fbUser = useFirebaseUser();
  const googleEmail = fbUser && !fbUser.isAnonymous ? fbUser.email ?? "verknüpft" : null;

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

  async function handleGoogleSignIn() {
    setBusy(true);
    try {
      const result = await signInWithGoogle();
      // Sync the server-side membership list into local known-groups, so
      // a fresh device picks up gruppen the user already belongs to.
      let serverGroups: string[] = [];
      try {
        serverGroups = await listMyGroupsCF();
        serverGroups.forEach((g) => addKnownGroup(g));
      } catch (e) {
        console.warn("listMyGroups failed:", e);
      }
      if (result.linked) {
        toast.success("Mit Google verknüpft 🎉");
      } else if (result.switched) {
        toast.success("Mit Google angemeldet 🎉");
      } else {
        toast.success("Mit Google angemeldet");
      }
      // Drop the user directly into their first available group.
      const target =
        getGroupId() ?? serverGroups[0] ?? knownGroups[0] ?? null;
      if (target) {
        setGroupId(target);
        setAuthed(true);
        setActiveGroup(target);
        nav("/");
        return;
      }
      // No groups yet → user falls back to the password form / create flow.
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // Silent — user just changed their mind.
      } else if (code === "auth/operation-not-allowed") {
        toast.error("Google-Login ist im Firebase-Projekt noch nicht aktiviert");
      } else if (code === "auth/popup-blocked") {
        toast.error("Popup vom Browser blockiert — bitte erlauben und nochmal versuchen");
      } else if (code === "auth/account-exists-with-different-credential") {
        toast.error("Dieser Account existiert schon mit einem anderen Provider");
      } else if (code === "auth/network-request-failed") {
        toast.error("Keine Internet-Verbindung");
      } else {
        console.error("Google sign-in failed:", err);
        const msg = code || (err as Error)?.message || "unbekannt";
        toast.error(`Google-Login fehlgeschlagen (${msg})`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignOut() {
    if (!confirm("Bei Google abmelden? Du wirst dann wieder anonym auf diesem Gerät.")) return;
    setBusy(true);
    try {
      setActiveGroup(null);
      setAuthed(false);
      await signOutAndReanon();
      toast.success("Bei Google abgemeldet");
    } catch (err) {
      console.error(err);
      toast.error("Abmelden fehlgeschlagen");
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

      {googleEmail ? (
        <div className="mb-5">
          <div className="w-full inline-flex items-center gap-2.5 py-3 px-3 rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/30 text-stone-900 dark:text-stone-50">
            <GoogleLogo />
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Mit Google angemeldet
              </div>
              <div className="text-[13px] font-semibold truncate">{googleEmail}</div>
            </div>
            <Icon.check size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>
          <div className="text-center mt-2">
            <button
              type="button"
              onClick={handleGoogleSignOut}
              disabled={busy}
              className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 underline disabled:opacity-50"
            >
              Bei Google abmelden
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={busy}
          className="mb-5 w-full inline-flex items-center justify-center gap-2.5 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 font-semibold text-[14px] active:scale-[0.99] disabled:opacity-50 transition-transform"
        >
          <GoogleLogo />
          Mit Google anmelden
        </button>
      )}

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
        Vertrauensbasis, kein Account-Zwang.<br />
        Mit Google bleibst du gerätübergreifend angemeldet.
      </p>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
