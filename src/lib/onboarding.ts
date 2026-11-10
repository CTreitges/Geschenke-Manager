// Onboarding-Zustand: alle Keys an einer Stelle, jeder Storage-Zugriff in
// try/catch. Wirft der Storage (Privatmodus, gesperrte Website-Daten), merkt
// sich das Modul die Werte für diesen App-Start im Speicher – so kann keine
// Umleitungs-Schleife ins Tutorial entstehen.

export const ONBOARDING_KEYS = {
  /** localStorage: Wert = TUTORIAL_VERSION, sobald das neue Tutorial verlassen wurde. */
  tutorial: "gm:onboarding:tutorial",
  /** localStorage: Tag (JJJJ-MM-TT), an dem „Wer bist du?“ zuletzt mit „Später“ beantwortet wurde. */
  identityAsked: "gm:onboarding:identity-asked",
  /** localStorage: bestehender Key des Installations-Tipps (Bestandsnutzer). */
  installTip: "gm:pwa-install-tip-seen:v1",
  /** localStorage: zuletzt gesehene Version unter „Was ist neu“. */
  whatsNewSeen: "gm:whats-new-seen",
  /** sessionStorage: Sitzung kam per Share- oder Magic-Link. */
  entryLink: "gm:entry-link",
  /** sessionStorage: In diesem App-Start wurde schon ein Schritt gezeigt. */
  stepShown: "gm:onboarding:step-shown",
} as const;

export const TUTORIAL_VERSION = "6";
export const WHATS_NEW_EVENT = "gm:whats-new-seen";

/** Alte Tutorial-Keys: zählen NICHT als gesehen, markieren aber Bestandsnutzer. */
const LEGACY_TUTORIAL_KEYS = [1, 2, 3, 4, 5].map((v) => `gm:tutorial-seen:v${v}`);

type Area = "local" | "session";
const memory = new Map<string, string>();

function storageOf(area: Area): Storage | undefined {
  return area === "local" ? globalThis.localStorage : globalThis.sessionStorage;
}

function read(area: Area, key: string): string | null {
  try {
    const value = storageOf(area)?.getItem(key);
    if (value != null) return value;
  } catch {
    /* Storage gesperrt → Speicher-Fallback */
  }
  return memory.get(`${area}:${key}`) ?? null;
}

function write(area: Area, key: string, value: string): void {
  memory.set(`${area}:${key}`, value);
  try {
    storageOf(area)?.setItem(key, value);
  } catch {
    /* nur für diesen App-Start gemerkt */
  }
}

// ─── Tutorial & „Was ist neu“ ───────────────────────────

export function isTutorialDone(): boolean {
  return read("local", ONBOARDING_KEYS.tutorial) === TUTORIAL_VERSION;
}

function isLegacyUser(): boolean {
  return LEGACY_TUTORIAL_KEYS.some((k) => read("local", k) === "yes");
}

export function getWhatsNewSeen(): string | null {
  return read("local", ONBOARDING_KEYS.whatsNewSeen);
}

export function hasUnseenVersion(currentVersion: string): boolean {
  return getWhatsNewSeen() !== currentVersion;
}

export function markWhatsNewSeen(version: string): void {
  write("local", ONBOARDING_KEYS.whatsNewSeen, version);
  try {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(WHATS_NEW_EVENT));
  } catch {
    /* ohne Event verschwindet der Punkt beim nächsten Render */
  }
}

/**
 * Beim Verlassen des Tutorials aufrufen (Überspringen, „Los geht's“, Zurück).
 * Neu-Nutzer (erster Abschluss, kein Alt-Key, noch nie „Was ist neu“
 * gesehen) bekommen die aktuelle Version als gesehen – kein Neu-Punkt für
 * die ganze Historie. Wiederholungen ändern „Was ist neu“ nie.
 */
export function markTutorialSeen(currentVersion: string): void {
  const isNewUser = !isTutorialDone() && !isLegacyUser() && getWhatsNewSeen() === null;
  write("local", ONBOARDING_KEYS.tutorial, TUTORIAL_VERSION);
  if (isNewUser) markWhatsNewSeen(currentVersion);
}

// ─── Weitere Flags ──────────────────────────────────────

export function markEntryLink(): void {
  write("session", ONBOARDING_KEYS.entryLink, "1");
}

export function isEntryLinkSession(): boolean {
  return read("session", ONBOARDING_KEYS.entryLink) === "1";
}

/** Lokaler Kalendertag „JJJJ-MM-TT“. */
export function dayStamp(now: number = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * „Später“ bei „Wer bist du?“: heute nicht mehr fragen, ab dem nächsten Tag
 * beim nächsten App-Start wieder – ohne Identität zeigt die Übersicht keine
 * Details, die Frage darf also nicht für immer verschwinden. Der frühere Wert
 * „yes“ zählt wie ein vergangener Tag.
 */
export function markIdentityAsked(now: number = Date.now()): void {
  write("local", ONBOARDING_KEYS.identityAsked, dayStamp(now));
}

export function markInstallTipSeen(): void {
  write("local", ONBOARDING_KEYS.installTip, "yes");
}

/** Beim Anzeigen eines Onboarding-Schritts aufrufen: höchstens einer pro App-Start. */
export function markStepShown(): void {
  write("session", ONBOARDING_KEYS.stepShown, "1");
}

/**
 * Test-Mail-Tipp (Kontext statt Dialog): nur, wenn gerade eine neue bzw.
 * geänderte E-Mail gespeichert wurde – nicht beim Leeren, nicht bei gleicher.
 */
export function isNewEmail(previous: string | null | undefined, saved: string): boolean {
  const next = saved.trim().toLowerCase();
  return next.length > 0 && next !== (previous ?? "").trim().toLowerCase();
}

// ─── Entscheidung ───────────────────────────────────────

export type OnboardingStep = "tutorial" | "identity" | "install-tip" | null;

export interface OnboardingFlags {
  entryLink: boolean;
  tutorialDone: boolean;
  identityAsked: boolean;
  installTipDone: boolean;
  stepShownThisSession: boolean;
}

export interface OnboardingContext extends OnboardingFlags {
  pathname: string;
  hasIdentity: boolean;
  personsCount: number;
  /** läuft als installierte App oder war schon einmal installiert */
  installed: boolean;
  /**
   * Gerade aus dem First-Run-Tutorial zurück: Die Frage nach der Identität
   * gehört noch zum selben Schritt („Danach IdentitySheet“, Spec §1).
   */
  afterTutorial?: boolean;
}

/** Liest die gespeicherten Flags; den Rest des Kontexts liefert die App. */
export function readOnboardingFlags(now: number = Date.now()): OnboardingFlags {
  return {
    entryLink: isEntryLinkSession(),
    tutorialDone: isTutorialDone(),
    identityAsked: read("local", ONBOARDING_KEYS.identityAsked) === dayStamp(now),
    installTipDone: read("local", ONBOARDING_KEYS.installTip) === "yes",
    stepShownThisSession: read("session", ONBOARDING_KEYS.stepShown) === "1",
  };
}

/**
 * Nächster Onboarding-Schritt: höchstens einer pro App-Start, nur auf „/“
 * und nie in einer Sitzung, die per Share- oder Magic-Link begann.
 */
export function nextOnboardingStep(c: OnboardingContext): OnboardingStep {
  if (c.entryLink || c.pathname !== "/") return null;
  const needsIdentity = !c.hasIdentity && !c.identityAsked && c.personsCount > 0;
  // Direkt nach dem Tutorial höchstens noch die Identität, sonst nichts.
  if (c.afterTutorial) return needsIdentity ? "identity" : null;
  if (c.stepShownThisSession) return null;
  if (!c.tutorialDone) return "tutorial";
  if (needsIdentity) return "identity";
  if (!c.installed && !c.installTipDone) return "install-tip";
  return null;
}
