import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button, Icon, Input } from "@/components/ui";
import {
  addKnownGroup,
  getGroupId,
  getKnownGroups,
  isAuthed,
  setAuthed,
  setGroupId,
} from "@/lib/auth";
import { joinGroupCF, setActiveGroup } from "@/lib/storage";
import { markEntryLink } from "@/lib/onboarding";
import { toast } from "sonner";

type Phase = "checking" | "login";

/**
 * Geschenk-Link /g/:groupId/gift/:giftId (auch Push-Deeplink mit ?vote=1):
 * anmelden bzw. Gruppe wechseln, dann ins Geschenk – Query-Parameter bleiben
 * erhalten. „Wer bist du?“ fragt das Geschenk selbst (IdentitySheet samt
 * „nur ansehen“), damit niemand aus Versehen die eigene Überraschung sieht.
 */
export default function ShareGift() {
  const { groupId, giftId } = useParams<{ groupId: string; giftId: string }>();
  const { search } = useLocation();
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>("checking");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const ranRef = useRef(false);

  const openGift = () => nav(`/gift/${giftId}${search}`, { replace: true, state: { fromShareLink: true } });

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    // Einstieg per Geschenk-Link: in dieser Sitzung kein Tutorial/Onboarding.
    markEntryLink();
    if (!groupId || !giftId) {
      nav("/", { replace: true });
      return;
    }
    if (isAuthed()) {
      if (getGroupId() === groupId) {
        openGift();
        return;
      }
      if (getKnownGroups().includes(groupId)) {
        setGroupId(groupId);
        setActiveGroup(groupId);
        openGift();
        return;
      }
    }
    setPhase("login");
    // Nur beim ersten Aufruf entscheiden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      openGift();
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
            aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"}
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
