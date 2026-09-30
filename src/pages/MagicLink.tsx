import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui";
import { GlowScreen } from "@/components/GlowScreen";
import { addKnownGroup, setAuthed, setGroupId, setIdentity } from "@/lib/auth";
import { consumeMagicTokenCF, setActiveGroup } from "@/lib/storage";
import { markEntryLink } from "@/lib/onboarding";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string };

/**
 * Lands here from the link in a birthday-reminder mail. Trades the
 * single-use token in the URL for { groupId, personId }, wires the
 * caller into that group + identity, then sends them to their
 * wishlist. The Cloud Function on the other end deletes the token
 * after one successful trade, so re-visits land in the error branch.
 */
export default function MagicLink() {
  const { token } = useParams<{ token: string }>();
  const nav = useNavigate();
  const [state, setState] = useState<State>({ kind: "loading" });

  // StrictMode mounts every effect twice in dev — guard so we only
  // exchange the token once. In production the guard is harmless.
  const consumed = useRef(false);

  useEffect(() => {
    if (consumed.current) return;
    // Einstieg per Mail-Link: in dieser Sitzung kein Tutorial/Onboarding.
    markEntryLink();
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      setState({ kind: "error", message: "Dieser Link sieht nicht richtig aus." });
      return;
    }
    consumed.current = true;

    (async () => {
      try {
        const { groupId, personId } = await consumeMagicTokenCF(token);
        addKnownGroup(groupId);
        setGroupId(groupId); // must run BEFORE setIdentity (identityKey depends on groupId)
        setAuthed(true);
        setActiveGroup(groupId);
        setIdentity(personId);
        nav("/wishlist", { replace: true });
      } catch (err) {
        const code =
          (err as { code?: string })?.code ??
          (err as { name?: string })?.name ??
          "unknown";
        const msg =
          code === "functions/failed-precondition"
            ? "Dieser Link wurde bereits einmal benutzt."
            : code === "functions/deadline-exceeded"
              ? "Dieser Link ist abgelaufen (7 Tage)."
              : code === "functions/not-found"
                ? "Dieser Link existiert nicht (oder wurde aufgeräumt)."
                : "Der Link konnte nicht eingelöst werden. Versuch's gleich nochmal.";
        setState({ kind: "error", message: msg });
      }
    })();
  }, [token, nav]);

  if (state.kind === "loading") {
    return (
      <GlowScreen className="flex items-center justify-center text-sm text-fg-muted">
        <span role="status">Öffne Wunschliste …</span>
      </GlowScreen>
    );
  }

  return (
    <GlowScreen className="flex items-center justify-center">
      <div className="w-full max-w-sm rounded-card border border-line-subtle bg-surface p-6 text-center shadow-card">
        <div aria-hidden className="mb-2 text-3xl">
          🔗
        </div>
        <h1 className="mb-2 text-lg font-bold text-fg">Link nicht einlösbar</h1>
        <p className="mb-5 text-sm leading-snug text-fg-soft">{state.message}</p>
        <Button onClick={() => nav("/login", { replace: true })} className="w-full">
          Zur Anmeldung
        </Button>
      </div>
    </GlowScreen>
  );
}
