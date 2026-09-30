import { describe, expect, it } from "vitest";
import {
  clearStoredToken,
  derivePushState,
  effectivePushPrefs,
  isIosDevice,
  needsTokenSync,
  parseStoredToken,
  PUSH_SYNC_INTERVAL_MS,
  PUSH_TOKEN_KEY,
  pushPlatform,
  readStoredToken,
  writeStoredToken,
} from "./pushState";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const throwingStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceeded");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";

describe("gespeicherter Token", () => {
  it("schreibt, liest und löscht den Eintrag unter gm:push-token", () => {
    const s = memoryStorage();
    writeStoredToken({ token: "t1", uid: "u1", syncedAt: 5 }, s);
    expect(s.map.has(PUSH_TOKEN_KEY)).toBe(true);
    expect(readStoredToken(s)).toEqual({ token: "t1", uid: "u1", syncedAt: 5 });
    clearStoredToken(s);
    expect(readStoredToken(s)).toBeNull();
  });

  it("verträgt kaputte oder unvollständige Einträge", () => {
    expect(parseStoredToken(null)).toBeNull();
    expect(parseStoredToken("{kaputt")).toBeNull();
    expect(parseStoredToken(JSON.stringify({ token: "t" }))).toBeNull();
    expect(parseStoredToken(JSON.stringify({ token: "t", uid: "u" }))).toEqual({ token: "t", uid: "u", syncedAt: 0 });
  });

  it("wirft nie, auch wenn localStorage gesperrt ist", () => {
    expect(readStoredToken(throwingStorage)).toBeNull();
    expect(() => writeStoredToken({ token: "t", uid: "u", syncedAt: 1 }, throwingStorage)).not.toThrow();
    expect(() => clearStoredToken(throwingStorage)).not.toThrow();
    expect(readStoredToken(null)).toBeNull();
  });
});

describe("needsTokenSync", () => {
  const now = 1_000_000_000_000;
  it("synchronisiert ohne Eintrag oder bei anderer UID", () => {
    expect(needsTokenSync(null, "u1", now)).toBe(true);
    expect(needsTokenSync({ token: "t", uid: "u0", syncedAt: now }, "u1", now)).toBe(true);
  });

  it("höchstens einmal pro Tag", () => {
    const fresh = { token: "t", uid: "u1", syncedAt: now - PUSH_SYNC_INTERVAL_MS + 1 };
    expect(needsTokenSync(fresh, "u1", now)).toBe(false);
    expect(needsTokenSync({ ...fresh, syncedAt: now - PUSH_SYNC_INTERVAL_MS }, "u1", now)).toBe(true);
  });

  it("Zeitstempel in der Zukunft (Uhr verstellt) erzwingt Sync", () => {
    expect(needsTokenSync({ token: "t", uid: "u1", syncedAt: now + 5000 }, "u1", now)).toBe(true);
  });
});

describe("Plattform", () => {
  it("erkennt iPhone, iPad (als Mac mit Touch), Android und Desktop", () => {
    expect(isIosDevice(IPHONE)).toBe(true);
    expect(isIosDevice(MAC, "MacIntel", 5)).toBe(true);
    expect(isIosDevice(MAC, "MacIntel", 0)).toBe(false);
    expect(pushPlatform(ANDROID)).toBe("android");
    expect(pushPlatform(MAC, "MacIntel", 0)).toBe("desktop");
    expect(pushPlatform(IPHONE)).toBe("ios");
  });
});

describe("derivePushState", () => {
  const base = { supported: true, ios: false, standalone: false, permission: "default" as NotificationPermission, registered: false };

  it("iPhone im Safari-Tab: erst installieren (auch ohne Notification-API)", () => {
    expect(derivePushState({ ...base, ios: true, supported: false, permission: null })).toBe("needs-install");
  });

  it("iPhone als Home-Bildschirm-App verhält sich normal", () => {
    expect(derivePushState({ ...base, ios: true, standalone: true, permission: "granted", registered: true })).toBe("on");
  });

  it("ohne Unterstützung: unsupported", () => {
    expect(derivePushState({ ...base, supported: false })).toBe("unsupported");
    expect(derivePushState({ ...base, permission: null })).toBe("unsupported");
  });

  it("blockiert, aus, an", () => {
    expect(derivePushState({ ...base, permission: "denied", registered: true })).toBe("denied");
    expect(derivePushState(base)).toBe("off");
    expect(derivePushState({ ...base, permission: "granted" })).toBe("off");
    expect(derivePushState({ ...base, permission: "granted", registered: true })).toBe("on");
  });
});

describe("effectivePushPrefs", () => {
  it("Abstimmungen erben notifyStack, solange notifyPolls nie gesetzt wurde", () => {
    expect(effectivePushPrefs({ notifyStack: true })).toEqual({ stack: true, polls: true });
    expect(effectivePushPrefs({ notifyStack: true, notifyPolls: false })).toEqual({ stack: true, polls: false });
    expect(effectivePushPrefs({ notifyPolls: true })).toEqual({ stack: false, polls: true });
    expect(effectivePushPrefs(undefined)).toEqual({ stack: false, polls: false });
  });
});
