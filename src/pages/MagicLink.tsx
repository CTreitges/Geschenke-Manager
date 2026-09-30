import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui";
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
      <div
        className="min-h-screen flex items-center justify-center text-stone-500 dark:text-stone-400 text-sm"
        style={{
          background:
            "radial-gradient(120% 60% at 50% 0%, #EDE9FE 0%, var(--gm-bg) 55%)",
        }}
      >
        Öffne Wunschliste…
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        background:
          "radial-gradient(120% 60% at 50% 0%, #EDE9FE 0%, var(--gm-bg) 55%)",
      }}
    >
      <div className="max-w-sm w-full bg-white dark:bg-stone-800 rounded-2xl border border-[#F0EBE6] dark:border-[#3A3633] p-6 text-center">
        <div className="text-3xl mb-2">🔗</div>
        <h1 className="text-lg font-bold text-stone-900 dark:text-stone-50 mb-2">
          Link nicht einlösbar
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-300 leading-snug mb-5">
          {state.message}
        </p>
        <Button onClick={() => nav("/login", { replace: true })} className="w-full">
          Zur Anmeldung
        </Button>
      </div>
    </div>
  );
}
