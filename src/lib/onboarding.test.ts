import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Onboarding = typeof import("./onboarding");

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
}

class ThrowingStorage extends MemoryStorage {
  getItem(): string | null {
    throw new DOMException("blocked", "SecurityError");
  }
  setItem(): void {
    throw new DOMException("quota", "QuotaExceededError");
  }
}

const VERSION = "v1.8.0";
let local: Storage;
let session: Storage;
let ob: Onboarding;

// Frisches Modul pro Test, damit der Speicher-Fallback nicht durchsickert.
async function load(localStore: Storage = new MemoryStorage(), sessionStore: Storage = new MemoryStorage()) {
  local = localStore;
  session = sessionStore;
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("sessionStorage", session);
  vi.resetModules();
  ob = await import("./onboarding");
}

function ctx(extra: Partial<Parameters<Onboarding["nextOnboardingStep"]>[0]> = {}) {
  return {
    ...ob.readOnboardingFlags(),
    pathname: "/",
    hasIdentity: false,
    personsCount: 3,
    installed: false,
    ...extra,
  };
}

beforeEach(async () => {
  vi.stubGlobal("window", new EventTarget());
  await load();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("nextOnboardingStep – Fälle aus dim-tutorial §5", () => {
  it("1: neu auf „/“ → tutorial", () => {
    expect(ob.nextOnboardingStep(ctx())).toBe("tutorial");
  });

  it("2: neu auf „/wishlist“ → null (Unterbrechung nur auf „/“)", () => {
    expect(ob.nextOnboardingStep(ctx({ pathname: "/wishlist" }))).toBeNull();
    expect(ob.nextOnboardingStep(ctx({ pathname: "/gift/g1" }))).toBeNull();
  });

  it("3: Einstieg per Share-/Magic-Link auf „/“ → null für die ganze Sitzung", () => {
    ob.markEntryLink();
    expect(session.getItem(ob.ONBOARDING_KEYS.entryLink)).toBe("1");
    expect(ob.isEntryLinkSession()).toBe(true);
    expect(ob.nextOnboardingStep(ctx())).toBeNull();
  });

  it("4: Tutorial fertig, ohne Identität → identity nur bei Personen > 0", () => {
    ob.markTutorialSeen(VERSION);
    expect(ob.nextOnboardingStep(ctx({ personsCount: 2 }))).toBe("identity");
    expect(ob.nextOnboardingStep(ctx({ personsCount: 0 }))).toBe("install-tip");
    expect(ob.nextOnboardingStep(ctx({ hasIdentity: true }))).toBe("install-tip");
  });

  it("5: schon ein Schritt in diesem App-Start → null", () => {
    ob.markStepShown();
    expect(ob.nextOnboardingStep(ctx())).toBeNull();
  });

  it("6: installiert → kein Installations-Tipp", () => {
    ob.markTutorialSeen(VERSION);
    expect(ob.nextOnboardingStep(ctx({ hasIdentity: true, installed: true }))).toBeNull();
  });

  it("7: Alt-Key v5 zählt NICHT als gesehen; nach dem Tutorial bleibt der Neu-Punkt", async () => {
    const legacy = new MemoryStorage();
    legacy.setItem("gm:tutorial-seen:v5", "yes");
    await load(legacy);
    expect(ob.isTutorialDone()).toBe(false);
    expect(ob.nextOnboardingStep(ctx())).toBe("tutorial");
    ob.markTutorialSeen(VERSION);
    expect(ob.isTutorialDone()).toBe(true);
    expect(ob.hasUnseenVersion(VERSION)).toBe(true);
  });

  it("7b: auch v1–v4 zählen nicht als gesehen", async () => {
    const legacy = new MemoryStorage();
    legacy.setItem("gm:tutorial-seen:v2", "yes");
    await load(legacy);
    expect(ob.nextOnboardingStep(ctx())).toBe("tutorial");
  });

  it("8: Neu-Nutzer schließt das Tutorial ab → kein Neu-Punkt", () => {
    const seen = vi.fn();
    window.addEventListener(ob.WHATS_NEW_EVENT, seen);
    expect(ob.hasUnseenVersion(VERSION)).toBe(true);
    ob.markTutorialSeen(VERSION);
    expect(local.getItem(ob.ONBOARDING_KEYS.tutorial)).toBe(ob.TUTORIAL_VERSION);
    expect(ob.hasUnseenVersion(VERSION)).toBe(false);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("9: werfender Storage → kein Absturz, Werte gelten für diesen App-Start", async () => {
    await load(new ThrowingStorage(), new ThrowingStorage());
    expect(() => ob.readOnboardingFlags()).not.toThrow();
    expect(ob.nextOnboardingStep(ctx())).toBe("tutorial");
    expect(() => ob.markStepShown()).not.toThrow();
    // keine Umleitungs-Schleife: zweiter Aufruf in derselben Sitzung liefert nichts
    expect(ob.nextOnboardingStep(ctx())).toBeNull();
    expect(() => ob.markTutorialSeen(VERSION)).not.toThrow();
    expect(ob.isTutorialDone()).toBe(true);
    expect(ob.hasUnseenVersion(VERSION)).toBe(false);
  });
});

describe("weitere Onboarding-Regeln", () => {
  it("„Später“ bei der Identität fragt nicht erneut → Installations-Tipp", () => {
    ob.markTutorialSeen(VERSION);
    ob.markIdentityAsked();
    expect(ob.nextOnboardingStep(ctx())).toBe("install-tip");
  });

  it("„Später“ gilt nur für den Tag: am nächsten Tag fragt der App-Start wieder (Regression SPO-01)", () => {
    const today = Date.parse("2026-10-01T09:00:00");
    ob.markTutorialSeen(VERSION);
    ob.markIdentityAsked(today);
    expect(local.getItem("gm:onboarding:identity-asked")).toBe("2026-10-01");
    expect(ob.readOnboardingFlags(Date.parse("2026-10-01T23:30:00")).identityAsked).toBe(true);
    const tomorrow = Date.parse("2026-10-02T07:00:00");
    expect(ob.nextOnboardingStep({ ...ctx(), ...ob.readOnboardingFlags(tomorrow) })).toBe("identity");
  });

  it("alter Wert „yes“ zählt wie ein vergangener Tag", () => {
    local.setItem("gm:onboarding:identity-asked", "yes");
    ob.markTutorialSeen(VERSION);
    expect(ob.readOnboardingFlags().identityAsked).toBe(false);
    expect(ob.nextOnboardingStep(ctx())).toBe("identity");
  });

  it("gesehener Installations-Tipp (auch alter Key) → nichts mehr", async () => {
    const existing = new MemoryStorage();
    existing.setItem("gm:pwa-install-tip-seen:v1", "yes");
    await load(existing);
    ob.markTutorialSeen(VERSION);
    expect(ob.nextOnboardingStep(ctx({ hasIdentity: true }))).toBeNull();
    await load();
    ob.markTutorialSeen(VERSION);
    ob.markInstallTipSeen();
    expect(ob.nextOnboardingStep(ctx({ hasIdentity: true }))).toBeNull();
  });

  it("Entry-Link sticht auch ein ungesehenes Tutorial auf „/“", () => {
    ob.markEntryLink();
    expect(ob.readOnboardingFlags().tutorialDone).toBe(false);
    expect(ob.nextOnboardingStep(ctx())).toBeNull();
  });

  it("Neu-Punkt: markWhatsNewSeen speichert die Version und feuert das Event", () => {
    const seen = vi.fn();
    window.addEventListener("gm:whats-new-seen", seen);
    ob.markWhatsNewSeen("v1.7.3");
    expect(ob.getWhatsNewSeen()).toBe("v1.7.3");
    expect(ob.hasUnseenVersion(VERSION)).toBe(true);
    ob.markWhatsNewSeen(VERSION);
    expect(ob.hasUnseenVersion(VERSION)).toBe(false);
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it("Bestandsnutzer mit älterer gesehener Version behalten den Neu-Punkt nach dem Tutorial", () => {
    ob.markWhatsNewSeen("v1.7.3");
    ob.markTutorialSeen(VERSION);
    expect(ob.getWhatsNewSeen()).toBe("v1.7.3");
    expect(ob.hasUnseenVersion(VERSION)).toBe(true);
  });

  it("Wiederholen des Tutorials ändert „Was ist neu“ nicht", () => {
    ob.markTutorialSeen("v1.8.0");
    ob.markTutorialSeen("v1.9.0");
    expect(ob.getWhatsNewSeen()).toBe("v1.8.0");
  });

  it("Wiederholen ohne gesehene Version markiert „Was ist neu“ nicht nachträglich", () => {
    local.setItem("gm:onboarding:tutorial", "6"); // Tutorial früher schon abgeschlossen
    ob.markTutorialSeen(VERSION);
    expect(ob.getWhatsNewSeen()).toBeNull();
    expect(ob.hasUnseenVersion(VERSION)).toBe(true);
  });

  it("direkt nach dem First-Run-Tutorial folgt die Identität – trotz gezeigtem Schritt", () => {
    ob.markStepShown();
    ob.markTutorialSeen(VERSION);
    expect(ob.nextOnboardingStep(ctx({ afterTutorial: true }))).toBe("identity");
    // ohne afterTutorial bleibt es bei einem Schritt pro App-Start
    expect(ob.nextOnboardingStep(ctx())).toBeNull();
  });

  it("nach dem Tutorial mit Identität, ohne Personen oder nach „Später“ → nichts (kein Install-Tipp)", () => {
    ob.markStepShown();
    ob.markTutorialSeen(VERSION);
    expect(ob.nextOnboardingStep(ctx({ afterTutorial: true, hasIdentity: true }))).toBeNull();
    expect(ob.nextOnboardingStep(ctx({ afterTutorial: true, personsCount: 0 }))).toBeNull();
    ob.markIdentityAsked();
    expect(ob.nextOnboardingStep(ctx({ afterTutorial: true }))).toBeNull();
  });

  it("afterTutorial sticht weder Entry-Link noch andere Pfade", () => {
    expect(ob.nextOnboardingStep(ctx({ afterTutorial: true, pathname: "/wishlist" }))).toBeNull();
    ob.markEntryLink();
    expect(ob.nextOnboardingStep(ctx({ afterTutorial: true }))).toBeNull();
  });

  it("Test-Mail-Tipp nur nach neuer bzw. geänderter E-Mail", () => {
    expect(ob.isNewEmail(undefined, "lea@example.org")).toBe(true);
    expect(ob.isNewEmail("alt@example.org", "neu@example.org")).toBe(true);
    expect(ob.isNewEmail("lea@example.org", " Lea@Example.org ")).toBe(false);
    expect(ob.isNewEmail("lea@example.org", "")).toBe(false);
    expect(ob.isNewEmail(null, "   ")).toBe(false);
  });

  it("funktioniert ohne window (kein Event, kein Fehler)", () => {
    vi.stubGlobal("window", undefined);
    expect(() => ob.markWhatsNewSeen(VERSION)).not.toThrow();
    expect(ob.hasUnseenVersion(VERSION)).toBe(false);
  });
});
