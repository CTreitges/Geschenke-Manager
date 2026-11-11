import { NOT_MEMBER_MESSAGE } from "@shared/errors";

// Zugangsverlust (z. B. aus der Gruppe entfernt, Gruppe gelöscht, neue
// anonyme UID): Statt nur zu loggen, schickt die App zum Login mit Hinweis.
// Nicht jeder permission-denied ist ein Zugangsverlust – Schreib-Ablehnungen
// durch Validierungs-Rules (Stimme nach Fristende) und „Wrong password“ in
// Passwort-Dialogen bleiben normale Fehler an ihrer Stelle.

/** Wert von location.state.notice für den Hinweis auf der Login-Seite. */
export const ACCESS_LOST_NOTICE = "access-lost";

export const ACCESS_LOST_TEXT =
  "Kein Zugriff mehr auf diese Gruppe. Melde dich mit Gruppen-ID und Passwort erneut an.";

function codeOf(err: unknown): string {
  return (err as { code?: string } | null)?.code ?? "";
}

/** Lesezugriff (Firestore-Subscription) wurde von den Rules abgelehnt. */
export function isReadDenied(err: unknown): boolean {
  return codeOf(err) === "permission-denied";
}

/** Function hat abgelehnt, weil der Aufrufer kein Mitglied (mehr) ist. */
export function isNotMemberError(err: unknown): boolean {
  return (
    codeOf(err) === "functions/permission-denied" &&
    (err as { message?: string } | null)?.message === NOT_MEMBER_MESSAGE
  );
}

// storage.ts meldet sich hier an (setzt permissionError). So können auch
// Module ohne Firebase-Abhängigkeit (z. B. Einstellungen → Test-Push) einen
// Function-Fehler melden.
const accessLossHandlers = new Set<() => void>();

export function onAccessLoss(handler: () => void): void {
  accessLossHandlers.add(handler);
}

/** Meldet einen Zugangsverlust, wenn `err` die Function-Ablehnung „Not a member“ ist. */
export function noteAccessLoss(err: unknown): void {
  if (isNotMemberError(err)) accessLossHandlers.forEach((h) => h());
}

/**
 * Soll die App nach einem Zugangsverlust zum Login wechseln? Nicht auf den
 * Seiten, die selbst beitreten oder anmelden (Login, Magic-Link, Gruppen-
 * und Teilen-Links) – sonst würfe der Hinweis sie aus ihrem eigenen Ablauf.
 */
export function shouldRedirectToLogin(permissionError: boolean, pathname: string): boolean {
  if (!permissionError) return false;
  return !(pathname === "/login" || pathname.startsWith("/login/") || pathname.startsWith("/m/") || pathname.startsWith("/g/"));
}

/** Liest den Hinweis aus location.state (Login-Seite). */
export function loginNotice(state: unknown): string | null {
  return (state as { notice?: unknown } | null | undefined)?.notice === ACCESS_LOST_NOTICE ? ACCESS_LOST_TEXT : null;
}
