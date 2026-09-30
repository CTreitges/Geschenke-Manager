import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button, IconButton, Input } from "@/components/ui";
import { GlowScreen, LogoTile } from "@/components/GlowScreen";
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
      <GlowScreen className="flex items-center justify-center text-sm text-fg-muted">
        <span role="status">Einen Moment …</span>
      </GlowScreen>
    );
  }

  return (
    <GlowScreen className="flex flex-col justify-center">
      <div className="mb-7 text-center">
        <LogoTile emoji="🎁" />
        <h1 className="m-0 text-title font-extrabold tracking-tight text-fg">Du wurdest eingeladen!</h1>
        <p className="mt-1.5 text-sm leading-normal text-fg-muted">
          Melde dich bei Gruppe <strong className="text-fg-soft">{groupId}</strong> an,
          <br />
          um das Geschenk zu sehen.
        </p>
      </div>
      <form onSubmit={handleLogin} className={`space-y-3 ${shake ? "animate-shake" : ""}`}>
        <Input label="Gruppe" value={groupId} readOnly className="cursor-default bg-surface-2 text-fg-muted" />
        <div className="relative">
          <Input
            label="Passwort"
            type={show ? "text" : "password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Gruppenpasswort"
            className="pr-12"
            autoFocus
          />
          <IconButton
            label={show ? "Passwort verbergen" : "Passwort anzeigen"}
            size="sm"
            pressed={show}
            onClick={() => setShow(!show)}
            className="absolute bottom-0.5 right-0.5"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </IconButton>
        </div>
        <Button type="submit" loading={busy} disabled={!pw} className="w-full" size="lg">
          Einloggen & Geschenk ansehen
        </Button>
      </form>
    </GlowScreen>
  );
}
