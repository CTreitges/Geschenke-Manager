import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Icon, Input, Overline, useConfirm } from "@/components/ui";
import { GlowScreen, LogoTile } from "@/components/GlowScreen";
import { addKnownGroup, getGroupId, isAuthed, setAuthed, setGroupId, useKnownGroups } from "@/lib/auth";
import { signInWithGoogle, signOutAndReanon, useFirebaseUser } from "@/lib/firebase";
import { loginTarget } from "@/lib/nav";
import { joinGroupCF, listMyGroupsCF, setActiveGroup } from "@/lib/storage";
import { toast } from "sonner";

export default function Login() {
  const [groupIdInput, setGroupIdInput] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  // Nach dem Login zurück dorthin, wo RequireAuth abgefangen hat (inkl. ?vote=1).
  const returnTo = loginTarget(useLocation().state);
  const goToTarget = () => nav(returnTo, { replace: true });
  const confirm = useConfirm();
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
      goToTarget();
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setBusy(true);
    try {
      const outcome = await signInWithGoogle("login");
      if (outcome.kind === "redirect") {
        // PWA-Modus — Browser lädt jetzt neu, App.tsx übernimmt nach Reload.
        return;
      }
      const result = outcome.result;
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
        goToTarget();
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
    const ok = await confirm({
      title: "Bei Google abmelden?",
      body: "Du bist danach wieder anonym auf diesem Gerät.",
      confirmLabel: "Abmelden",
    });
    if (!ok) return;
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
    <GlowScreen className="flex flex-col justify-center">
      <div className="mb-7 text-center">
        <LogoTile emoji="🎁" />
        <h1 className="m-0 text-title font-extrabold tracking-tight text-fg">Geschenke-Manager</h1>
        <p className="mt-1.5 text-sm leading-normal text-fg-muted">
          Wer bekommt als Nächstes was?
          <br />
          Gemeinsam, ohne Chaos.
        </p>
      </div>

      {googleEmail ? (
        <div className="mb-5">
          <div className="inline-flex w-full items-center gap-2.5 rounded-card border border-status-received/40 bg-status-received-soft px-3 py-3 text-fg">
            <GoogleLogo />
            <div className="min-w-0 flex-1 text-left">
              <div className="text-2xs font-bold uppercase tracking-wide text-status-received">Mit Google angemeldet</div>
              <div className="truncate text-meta font-semibold">{googleEmail}</div>
            </div>
            <Icon.check size={18} className="shrink-0 text-status-received" />
          </div>
          <div className="mt-1 text-center">
            <button
              type="button"
              onClick={handleGoogleSignOut}
              disabled={busy}
              className="min-h-tap px-3 text-xs font-semibold text-fg-muted underline disabled:opacity-50"
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
          className="mb-5 inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-card border border-line bg-surface py-3 text-sm font-semibold text-fg transition-transform active:scale-[0.99] disabled:opacity-50"
        >
          <GoogleLogo />
          Mit Google anmelden
        </button>
      )}

      {showSaved && (
        <div className="mb-5">
          <Overline className="mb-1.5 pl-1">Schon eingeloggt</Overline>
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            {knownGroups.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGroupId(g);
                  goToTarget();
                }}
                className="flex min-h-12 w-full items-center gap-2 border-t border-line-subtle px-3.5 py-2.5 first:border-t-0 hover:bg-surface-2/60"
              >
                <Icon.users size={14} className="text-fg-muted" />
                <span className="flex-1 text-left text-sm font-semibold text-fg">{g}</span>
                <Icon.chev size={14} className="text-fg-muted" />
              </button>
            ))}
          </div>
          <Overline className="mb-1.5 mt-4 pl-1">Oder einer weiteren Gruppe beitreten</Overline>
        </div>
      )}

      <form onSubmit={submit} className={`flex flex-col gap-3 ${shake ? "animate-shake" : ""}`}>
        <div className="relative">
          <div className="pointer-events-none absolute left-3 top-3.5 text-fg-muted">
            <Icon.users />
          </div>
          <Input
            type="text"
            placeholder="Gruppen-ID"
            aria-label="Gruppen-ID"
            value={groupIdInput}
            onChange={(e) => setGroupIdInput(e.target.value)}
            className="pl-11"
            autoFocus
            autoComplete="username"
            spellCheck={false}
          />
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
            autoComplete="current-password"
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
        <Button type="submit" size="lg" disabled={busy || !groupIdInput.trim() || !pw}>
          {busy ? "Prüfe…" : "Reinkommen"}
          <Icon.chev />
        </Button>
      </form>

      <div className="mt-4 text-center">
        <Link to="/login/new" className="inline-flex min-h-tap items-center px-3 text-sm font-semibold text-accent-text">
          + Neue Gruppe erstellen
        </Link>
      </div>

      <p className="mt-4 text-center text-xs leading-normal text-fg-muted">
        Vertrauensbasis, kein Account-Zwang.
        <br />
        Mit Google bleibst du gerätübergreifend angemeldet.
      </p>
    </GlowScreen>
  );
}

// Google-Logo: Markenfarben laut Google-Richtlinie, nicht einfärbbar.
const GOOGLE = {
  blue: "#4285F4", // design-ok: Google-Markenfarbe (Logo)
  green: "#34A853", // design-ok: Google-Markenfarbe (Logo)
  yellow: "#FBBC05", // design-ok: Google-Markenfarbe (Logo)
  red: "#EA4335", // design-ok: Google-Markenfarbe (Logo)
};

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill={GOOGLE.blue}
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill={GOOGLE.green}
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill={GOOGLE.yellow}
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
      />
      <path
        fill={GOOGLE.red}
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
