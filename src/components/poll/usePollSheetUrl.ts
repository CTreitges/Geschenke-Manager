import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { canGoBack } from "@/lib/nav";

// Offen-Zustand des Abstimmungs-Sheets in der URL (`?vote=1`): ein Mechanismus
// für Push-Deeplink, Home-Chip und App-Knöpfe. Wir öffnen per push mit
// state.voteSheet, Zurück schließt also das Sheet. Kommt `?vote=1` von außen
// (ohne state), entscheidet der Aufrufer: adoptLink() macht daraus denselben
// Zustand (Basis-Eintrag ersetzen + Sheet-Eintrag pushen), dropLink() entfernt
// den Parameter.

const PARAM = "vote";

type VoteState = { voteSheet?: boolean } | null;

export interface PollSheetUrl {
  /** Sheet ist offen (eigener History-Eintrag). */
  open: boolean;
  /** `?vote=1` kam per Link und wartet auf adoptLink()/dropLink(). */
  linkPending: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  adoptLink: () => void;
  dropLink: () => void;
}

export function usePollSheetUrl(): PollSheetUrl {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const inUrl = params.get(PARAM) === "1";
  const own = (location.state as VoteState)?.voteSheet === true;
  const open = inUrl && own;

  const { withParam, withoutParam } = useMemo(() => {
    const without = new URLSearchParams(params);
    without.delete(PARAM);
    const withP = new URLSearchParams(without);
    withP.set(PARAM, "1");
    const rest = without.toString();
    return { withParam: `?${withP.toString()}`, withoutParam: rest ? `?${rest}` : "" };
  }, [params]);

  // Schutz gegen doppeltes navigate(-1), z. B. „Verwerfen“ + Aufräum-Effekt.
  const closingRef = useRef(false);
  useEffect(() => {
    if (!open) closingRef.current = false;
  }, [open]);

  const openSheet = useCallback(() => {
    navigate({ search: withParam }, { state: { voteSheet: true } });
  }, [navigate, withParam]);

  const closeSheet = useCallback(() => {
    if (!open || closingRef.current) return;
    closingRef.current = true;
    if (canGoBack(window.history.state)) navigate(-1);
    else navigate({ search: withoutParam }, { replace: true });
  }, [open, navigate, withoutParam]);

  const adoptLink = useCallback(() => {
    navigate({ search: withoutParam }, { replace: true, state: location.state });
    navigate({ search: withParam }, { state: { voteSheet: true } });
  }, [navigate, withParam, withoutParam, location.state]);

  const dropLink = useCallback(() => {
    navigate({ search: withoutParam }, { replace: true, state: location.state });
  }, [navigate, withoutParam, location.state]);

  return { open, linkPending: inUrl && !own, openSheet, closeSheet, adoptLink, dropLink };
}
