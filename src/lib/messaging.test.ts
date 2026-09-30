// Tests für messaging.ts mit nachgebautem Firebase-SDK, Service Worker und
// localStorage (Node-Umgebung): UID-Wechsel ohne Reload (PUSH-01), Gruppe
// verlassen (PUSH-02), Abo-Rotation (PUSH-07), geteiltes Gerät (PUSH-08).

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readStoredToken, writeStoredToken, type StoredPushToken } from "./pushState";

const h = vi.hoisted(() => ({
  /** auth.currentUser?.uid — authReady bleibt bei der Start-UID "u-start". */
  uid: "u-start" as string | null,
  token: "tok-1",
  tokenSeq: 1,
  endpoint: "https://push.example/ep-1" as string | null,
  deleteTokenError: null as Error | null,
  updateError: null as Error | null,
  /** Reihenfolge der FCM-Aufrufe. */
  fcm: [] as string[],
  writes: [] as { op: "set" | "update"; path: string; data: unknown }[],
}));

vi.mock("./firebase", () => ({
  app: {},
  db: {},
  functions: {},
  auth: {
    get currentUser() {
      return h.uid ? { uid: h.uid } : null;
    },
  },
  authReady: Promise.resolve("u-start"),
  useFirebaseUser: () => null,
}));

vi.mock("firebase/messaging", () => ({
  isSupported: async () => true,
  getMessaging: () => ({}),
  getToken: async () => {
    h.fcm.push("getToken");
    return h.token;
  },
  // Wie das SDK: Token bei FCM abmelden, Abo kündigen → nächster getToken liefert einen neuen.
  deleteToken: async () => {
    h.fcm.push("deleteToken");
    if (h.deleteTokenError) throw h.deleteTokenError;
    h.token = `tok-${++h.tokenSeq}`;
    return true;
  },
}));

vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...segments: string[]) => ({ path: segments.join("/") }),
  setDoc: async (ref: { path: string }, data: unknown) => {
    h.writes.push({ op: "set", path: ref.path, data });
  },
  updateDoc: async (ref: { path: string }, ...rest: unknown[]) => {
    if (h.updateError) throw h.updateError;
    h.writes.push({ op: "update", path: ref.path, data: rest.length === 1 ? rest[0] : rest });
  },
  deleteField: () => "<deleteField>",
  serverTimestamp: () => "<ts>",
  FieldPath: class {
    constructor(readonly field: string) {}
  },
  onSnapshot: () => () => undefined,
}));

vi.mock("./pwa", () => ({ isStandalonePWA: () => false }));

vi.mock("firebase/functions", () => ({
  httpsCallable: () => async () => ({ data: { sent: 0 } }),
}));

const EP1 = "https://push.example/ep-1";
const EP2 = "https://push.example/ep-2";

const store = new Map<string, string>();
const registration = {
  active: {},
  update: async () => undefined,
  pushManager: {
    getSubscription: async () => (h.endpoint ? { endpoint: h.endpoint } : null),
  },
};

let m: typeof import("./messaging");

beforeAll(async () => {
  // VAPID-Key wird beim Import gelesen → vor dem Import setzen.
  vi.stubEnv("VITE_FIREBASE_VAPID_KEY", "vapid-test");
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal("window", {
    Notification: {},
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
  });
  vi.stubGlobal("Notification", { permission: "granted", requestPermission: async () => "granted" });
  vi.stubGlobal("navigator", {
    userAgent: "vitest",
    platform: "test",
    serviceWorker: {
      register: async () => registration,
      getRegistration: async () => registration,
    },
  });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  m = await import("./messaging");
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

beforeEach(() => {
  h.uid = "u-start";
  h.token = "tok-1";
  h.tokenSeq = 1;
  h.endpoint = EP1;
  h.deleteTokenError = null;
  h.updateError = null;
  h.fcm = [];
  h.writes = [];
  store.clear();
});

function seed(value: Partial<StoredPushToken> = {}) {
  writeStoredToken({ token: "tok-1", uid: "u-start", syncedAt: Date.now() - 1000, endpoint: EP1, ...value });
}

const paths = () => h.writes.map((w) => `${w.op} ${w.path}`);

describe("PUSH-01: UID-Wechsel ohne Reload", () => {
  it("schreibt Token und Schalter unter der aktuellen UID, nicht unter der Start-UID", async () => {
    h.uid = "u-new"; // nach signOutAndReanon
    await m.enablePushForGroup("g1");
    await m.setPushPrefs("g1", { notifyPolls: false });
    expect(paths()).toEqual([
      "set pushTokens/u-new",
      "update groups/g1/members/u-new",
      "update groups/g1/members/u-new",
    ]);
    expect(readStoredToken()?.uid).toBe("u-new");
  });

  it("Token-Sync nach UID-Wechsel landet unter der neuen UID", async () => {
    h.uid = "u-new";
    await m.syncPushToken();
    expect(paths()).toEqual(["set pushTokens/u-new"]);
  });

  it("fällt ohne currentUser auf die UID aus authReady zurück", async () => {
    h.uid = null;
    await m.setPushPrefs("g1", { notifyStack: true });
    expect(paths()).toEqual(["update groups/g1/members/u-start"]);
  });
});

describe("PUSH-02: Gruppe auf diesem Gerät verlassen", () => {
  it("schaltet nur die Schalter dieser Gruppe ab und lässt den Geräte-Token stehen", async () => {
    seed();
    await m.disablePushForGroup("g1");
    expect(h.writes).toEqual([
      { op: "update", path: "groups/g1/members/u-start", data: { notifyStack: false, notifyPolls: false } },
    ]);
    expect(h.fcm).toEqual([]); // kein deleteToken → andere Gruppen behalten Push
    expect(readStoredToken()?.token).toBe("tok-1");
  });

  it("wirft nicht, wenn das Member-Doc nicht mehr beschreibbar ist", async () => {
    h.updateError = Object.assign(new Error("not-found"), { code: "not-found" });
    await expect(m.disablePushForGroup("g1")).resolves.toBeUndefined();
  });
});

describe("PUSH-07: Abo-Rotation", () => {
  it("registriert bei geändertem Endpoint sofort neu, trotz Tages-Takt", async () => {
    seed();
    h.endpoint = EP2;
    await m.syncPushToken();
    expect(h.fcm).toEqual(["getToken"]);
    expect(paths()).toEqual(["set pushTokens/u-start"]);
    expect(readStoredToken()?.endpoint).toBe(EP2);
  });

  it("registriert sofort neu, wenn das Abo ganz fehlt", async () => {
    seed();
    h.endpoint = null;
    await m.syncPushToken();
    expect(h.fcm).toEqual(["getToken"]);
  });

  it("lässt einen frischen Token mit gleichem Endpoint in Ruhe", async () => {
    seed();
    await m.syncPushToken();
    expect(h.fcm).toEqual([]);
    expect(h.writes).toEqual([]);
  });

  it("pushsubscriptionchange vom Worker erzwingt den Sync (force)", async () => {
    seed();
    const resync = vi.fn();
    const navigate = vi.fn();
    m.handlePushWorkerMessage({ type: "GM_PUSH_SUBSCRIPTION_CHANGE" }, { navigate, resync });
    expect(resync).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();

    await m.syncPushToken({ force: true });
    expect(h.fcm).toEqual(["getToken"]);
  });

  it("GM_NAVIGATE navigiert nur zu App-internen Pfaden", () => {
    const navigate = vi.fn();
    const resync = vi.fn();
    m.handlePushWorkerMessage({ type: "GM_NAVIGATE", url: "/g/abc/gift/g1?vote=1" }, { navigate, resync });
    m.handlePushWorkerMessage({ type: "GM_NAVIGATE", url: "//evil.example/x" }, { navigate, resync });
    m.handlePushWorkerMessage({ type: "GM_NAVIGATE", url: "https://evil.example/x" }, { navigate, resync });
    m.handlePushWorkerMessage(null, { navigate, resync });
    expect(navigate.mock.calls).toEqual([["/g/abc/gift/g1?vote=1"]]);
    expect(resync).not.toHaveBeenCalled();
  });
});

describe("PUSH-08: geteiltes Gerät", () => {
  it("Merker einer anderen UID: erst deleteToken, dann neuer Token nur unter der neuen UID", async () => {
    seed({ uid: "u-old" });
    await m.syncPushToken();
    expect(h.fcm).toEqual(["deleteToken", "getToken"]);
    expect(paths()).toEqual(["set pushTokens/u-start"]);
    expect(Object.keys(h.writes[0].data as object)).toEqual(["tok-2"]);
    expect(readStoredToken()).toMatchObject({ token: "tok-2", uid: "u-start" });
  });

  it("scheitert deleteToken, wird nichts registriert und der Merker bleibt für den nächsten Versuch", async () => {
    seed({ uid: "u-old" });
    h.deleteTokenError = new Error("offline");
    await m.syncPushToken();
    expect(h.fcm).toEqual(["deleteToken"]);
    expect(h.writes).toEqual([]);
    expect(readStoredToken()?.uid).toBe("u-old");
  });

  it("Abmelden: Merker wird nur nach erfolgreichem deleteToken vergessen", async () => {
    seed();
    h.deleteTokenError = new Error("Timeout");
    await m.unregisterPushOnLogout();
    expect(readStoredToken()?.uid).toBe("u-start"); // nächster Sync unter neuer UID meldet ab

    h.deleteTokenError = null;
    h.writes = [];
    await m.unregisterPushOnLogout();
    expect(paths()).toEqual(["update pushTokens/u-start"]);
    expect(readStoredToken()).toBeNull();
  });
});
