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

/**
 * Wie useBack, aber `then` (z. B. das Löschen) läuft erst, wenn die Seite
 * verlassen ist – sonst blitzt kurz „nicht gefunden“ auf. Ohne App-Eintrag
 * davor geht es per replace zu `fallback`, damit Zurück nie auf die
 * gelöschte Seite führt (B13).
 */
export function useLeave(fallback: string): (then?: () => void) => void {
  const navigate = useNavigate();
  return useCallback(
    (then?: () => void) => {
      if (!canGoBack(window.history.state)) {
        navigate(fallback, { replace: true });
        then?.();
        return;
      }
      if (then) {
        let done = false;
        const run = () => {
          if (done) return;
          done = true;
          window.removeEventListener("popstate", run);
          then();
        };
        window.addEventListener("popstate", run);
        // Sicherheitsnetz, falls das popstate ausbleibt.
        setTimeout(run, 800);
      }
      navigate(-1);
    },
    [navigate, fallback],
  );
}

export type TabKey = "home" | "people" | "wishlist" | "settings" | "feedback";

/** Aktiver Bottom-Tab, auch auf Unterseiten: /person/* → Personen, /gift/* und /past → Übersicht. */
export function activeTab(pathname: string): TabKey | null {
  if (pathname === "/" || pathname.startsWith("/gift/") || pathname === "/past") return "home";
  if (pathname === "/people" || pathname.startsWith("/person/")) return "people";
  if (pathname === "/wishlist") return "wishlist";
  if (pathname === "/settings") return "settings";
  if (pathname === "/feedback") return "feedback";
  return null;
}

/**
 * Ziel nach dem Login: der von RequireAuth gemerkte Ort (state.from) samt
 * Query und Hash – z. B. /gift/anna_2026?vote=1 –, sonst „/“. Nur App-interne
 * Pfade, nie zurück auf /login.
 */
export function loginTarget(state: unknown): string {
  const from = (state as { from?: { pathname?: unknown; search?: unknown; hash?: unknown } } | null | undefined)?.from;
  const path = typeof from?.pathname === "string" ? from.pathname : "";
  if (!path.startsWith("/") || path.startsWith("//") || path === "/login" || path.startsWith("/login/")) return "/";
  const search = typeof from?.search === "string" && from.search.startsWith("?") ? from.search : "";
  const hash = typeof from?.hash === "string" && from.hash.startsWith("#") ? from.hash : "";
  return path + search + hash;
}
