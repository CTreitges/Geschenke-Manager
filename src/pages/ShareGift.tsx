import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Button, Icon, Input } from "@/components/ui";
import {
  addKnownGroup,
  getGroupId,
  getIdentity,
  getKnownGroups,
  isAuthed,
  setAuthed,
  setGroupId,
  setIdentity,
} from "@/lib/auth";
import { joinGroupCF, setActiveGroup } from "@/lib/storage";
import { useStore } from "@/lib/hooks";
import { toast } from "sonner";

type Phase = "checking" | "login" | "identity" | "done";

export default function ShareGift() {
  const { groupId, giftId } = useParams<{ groupId: string; giftId: string }>();
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>("checking");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const { persons, personsHydrated } = useStore();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (!groupId || !giftId) {
      nav("/", { replace: true });
      return;
    }
    if (isAuthed()) {
      const current = getGroupId();
      if (current === groupId) {
        if (getIdentity()) {
          nav(`/gift/${giftId}`, { replace: true, state: { fromShareLink: true } });
        } else {
          setPhase("identity");
        }
        return;
      }
      const known = getKnownGroups();
      if (known.includes(groupId)) {
        setGroupId(groupId);
        setActiveGroup(groupId);
        if (getIdentity()) {
          nav(`/gift/${giftId}`, { replace: true, state: { fromShareLink: true } });
        } else {
          setPhase("identity");
        }
        return;
      }
    }
    setPhase("login");
  }, [groupId, giftId, nav]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!groupId || !pw) return;
    setBusy(true);
    try {
      await joinGroupCF(groupId, pw);
      addKnownGroup(groupId);
      setGroupId(groupId);
      setAuthed(true);
      setActiveGroup(groupId);
      if (getIdentity()) {
        nav(`/gift/${giftId}`, { replace: true, state: { fromShareLink: true } });
      } else {
        setPhase("identity");
      }
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      setShake(true);
      setTimeout(() => setShake(false), 400);
      if (code === "functions/not-found") toast.error("Gruppe nicht gefunden");
      else if (code === "functions/permission-denied") toast.error("Falsches Passwort");
      else if (code === "functions/unauthenticated") toast.error("Anonyme Anmeldung startet — kurz warten und nochmal");
      else toast.error("Login fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  function handlePickIdentity(personId: string) {
    setIdentity(personId);
    nav(`/gift/${giftId}`, { replace: true, state: { fromShareLink: true } });
  }

  if (phase === "checking") {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-stone-500 dark:text-stone-400 text-sm"
        style={{ background: "radial-gradient(120% 60% at 50% 0%, #EDE9FE 0%, var(--gm-bg) 55%)" }}
      >
        Einen Moment...
      </div>
    );
  }

  if (phase === "done") {
    nav(`/gift/${giftId}`, { replace: true, state: { fromShareLink: true } });
    return null;
  }

  if (phase === "login") {
    return (
      <div
        className="min-h-screen flex flex-col justify-center px-6"
        style={{ background: "radial-gradient(120% 60% at 50% 0%, #EDE9FE 0%, var(--gm-bg) 55%)" }}
      >
        <div className="text-center mb-7">
          <div
            className="w-[78px] h-[78px] mx-auto mb-4 rounded-3xl flex items-center justify-center text-[38px]"
            style={{
              background: "linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)",
              boxShadow: "0 12px 28px -8px rgba(124,58,237,0.5), inset 0 0 0 1px rgba(255,255,255,0.2)",
            }}
          >
            🎁
          </div>
          <h1 className="m-0 text-[22px] font-extrabold tracking-tight text-stone-900 dark:text-stone-50">
            Du wurdest eingeladen!
          </h1>
          <p className="mt-1.5 text-sm leading-[1.5] text-stone-500 dark:text-stone-400">
            Melde dich bei Gruppe <strong className="text-stone-700 dark:text-stone-300">{groupId}</strong> an,<br />um das Geschenk zu sehen.
          </p>
        </div>
        <form onSubmit={handleLogin} className={`space-y-3 ${shake ? "animate-shake" : ""}`}>
          <Input
            label="Gruppe"
            value={groupId}
            readOnly
            className="bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 cursor-default"
          />
          <div className="relative">
            <Input
              label="Passwort"
              type={show ? "text" : "password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Gruppenpasswort"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-3 top-[38px] text-stone-400 p-1"
            >
              <Icon.lock size={16} />
            </button>
          </div>
          <Button type="submit" disabled={busy || !pw} className="w-full" size="lg">
            {busy ? "..." : "Einloggen & Geschenk ansehen"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col justify-center px-6"
      style={{ background: "radial-gradient(120% 60% at 50% 0%, #EDE9FE 0%, var(--gm-bg) 55%)" }}
    >
      <div className="text-center mb-6">
        <div className="text-5xl mb-3">👋</div>
        <h1 className="m-0 text-[22px] font-extrabold tracking-tight text-stone-900 dark:text-stone-50">
          Wer bist du?
        </h1>
        <p className="mt-1.5 text-sm leading-[1.5] text-stone-500 dark:text-stone-400">
          Damit Teilnahme und Abstimmung funktionieren,<br />wähle einmalig deinen Namen.
        </p>
      </div>

      {!personsHydrated ? (
        <div className="text-center text-stone-400 text-sm py-8">Lade Personen...</div>
      ) : persons.length === 0 ? (
        <div className="text-center text-stone-400 text-sm py-8">Keine Personen in der Gruppe gefunden.</div>
      ) : (
        <div className="space-y-2">
          {persons.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePickIdentity(p.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-left active:scale-[0.99] transition-transform shadow-sm"
            >
              <Avatar person={p} size={42} />
              <span className="flex-1 text-[15px] font-semibold text-stone-900 dark:text-stone-50">
                {p.name}
              </span>
              <Icon.chev className="text-stone-300 dark:text-stone-600" />
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => nav(`/gift/${giftId}`, { replace: true, state: { fromShareLink: true } })}
        className="mt-6 text-center text-[13px] text-stone-400 dark:text-stone-500 underline w-full"
      >
        Lieber nicht festlegen
      </button>
    </div>
  );
}
