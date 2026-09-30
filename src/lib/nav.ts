import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

// Zurück-Navigation ohne die App zu verlassen. BrowserRouter (react-router-dom
// 6.30 / @remix-run/router 1.23) legt `history.state.idx` an: 0 = erster
// App-Eintrag, push zählt hoch, replace behält den Index.

/** true, wenn es in dieser App-Sitzung einen Eintrag davor gibt. */
export function canGoBack(state: unknown): boolean {
  const idx = (state as { idx?: unknown } | null | undefined)?.idx;
  return typeof idx === "number" && idx > 0;
}

/**
 * Zurück-Handler: navigate(-1), wenn es einen App-Eintrag davor gibt, sonst
 * `fallback` mit replace (Direkteinstieg per Link, Push oder Reload).
 */
export function useBack(fallback: string): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    if (canGoBack(window.history.state)) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}
