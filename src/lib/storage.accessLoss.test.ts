// Zugangsverlust über die echte Naht storage.ts: Fehler aus Firestore-
// Subscriptions bzw. Callables (nachgebaut) → state.permissionError, das
// AccessLossRedirect (App.tsx) per shouldRedirectToLogin zum Login macht.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOT_MEMBER_MESSAGE } from "@shared/errors";
import { ACCESS_LOST_TEXT, loginNotice, noteAccessLoss, shouldRedirectToLogin } from "./accessLoss";

type ErrCb = (err: unknown) => void;

const h = vi.hoisted(() => ({
  errorCallbacks: new Map<string, (err: unknown) => void>(),
  callError: null as unknown,
}));

vi.mock("./firebase", () => ({
  app: {},
  db: {},
  functions: {},
  auth: { currentUser: null },
  authReady: Promise.resolve("u1"),
}));
vi.mock("./auth", () => ({ getIdentity: () => null }));
vi.mock("firebase/auth", () => ({ onAuthStateChanged: () => () => undefined }));
vi.mock("firebase/functions", () => ({
  httpsCallable: () => async () => {
    if (h.callError) throw h.callError;
    return { data: {} };
  },
}));
vi.mock("firebase/firestore", () => {
  const ref = (_db: unknown, ...segments: string[]) => ({ path: segments.join("/") });
  return {
    collection: ref,
    doc: ref,
    query: (r: unknown) => r,
    where: () => ({}),
    limit: () => ({}),
    deleteField: () => "<deleteField>",
    FieldPath: class {},
    onSnapshot: (r: { path: string }, ...rest: unknown[]) => {
      const fns = rest.filter((x) => typeof x === "function") as ErrCb[];
      h.errorCallbacks.set(r.path, fns[fns.length - 1]);
      return () => undefined;
    },
  };
});

const s = await import("./storage");

/** Firebase-Fehlerform: code + message (FirestoreError bzw. FunctionsError). */
const fbError = (code: string, message = "") => Object.assign(new Error(message), { code });

async function start() {
  s.setActiveGroup("g1");
  await vi.waitFor(() => expect(h.errorCallbacks.has("groups/g1/gifts")).toBe(true));
}

/** Was die App nach dem Fehler auf der Startseite täte. */
const redirectsToLogin = () => shouldRedirectToLogin(s.getSnapshot().permissionError, "/");

beforeEach(() => {
  h.errorCallbacks.clear();
  h.callError = null;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  s.setActiveGroup(null);
  vi.restoreAllMocks();
});

describe("permission-denied aus Firestore", () => {
  it("abgelehnter Lesezugriff einer Subscription führt zum Login mit Hinweis", async () => {
    await start();
    expect(redirectsToLogin()).toBe(false);
    h.errorCallbacks.get("groups/g1/gifts")!(fbError("permission-denied", "Missing or insufficient permissions."));
    expect(s.getSnapshot().permissionError).toBe(true);
    expect(redirectsToLogin()).toBe(true);
    expect(loginNotice({ notice: "access-lost" })).toBe(ACCESS_LOST_TEXT);
  });

  it("andere Subscription-Fehler (offline) bleiben wie bisher: nur Log, kein Login", async () => {
    await start();
    h.errorCallbacks.get("groups/g1/gifts")!(fbError("unavailable"));
    expect(s.getSnapshot().permissionError).toBe(false);
    expect(redirectsToLogin()).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe("permission-denied aus einer Function", () => {
  it("„Not a member“ setzt den Zugangsverlust und reicht den Fehler weiter", async () => {
    await start();
    h.callError = fbError("functions/permission-denied", NOT_MEMBER_MESSAGE);
    await expect(s.changePasswordCF("g1", "alt", "neu")).rejects.toMatchObject({ code: "functions/permission-denied" });
    expect(redirectsToLogin()).toBe(true);
  });

  it("gilt auch für die Test-Mail", async () => {
    await start();
    h.callError = fbError("functions/permission-denied", NOT_MEMBER_MESSAGE);
    await expect(s.sendTestMailCF("p1")).rejects.toBeDefined();
    expect(redirectsToLogin()).toBe(true);
  });

  it("falsches Passwort im Dialog bleibt ein normaler Fehler (kein Login)", async () => {
    await start();
    h.callError = fbError("functions/permission-denied", "Wrong password");
    await expect(s.deleteGroupCF("g1", "falsch")).rejects.toMatchObject({ code: "functions/permission-denied" });
    expect(redirectsToLogin()).toBe(false);
  });

  it("andere Function-Fehler bleiben wie bisher", async () => {
    await start();
    h.callError = fbError("functions/internal", "boom");
    await expect(s.changePasswordCF("g1", "alt", "neu")).rejects.toMatchObject({ code: "functions/internal" });
    expect(redirectsToLogin()).toBe(false);
  });

  it("noteAccessLoss (Test-Push in den Einstellungen) erkennt nur „Not a member“", async () => {
    await start();
    noteAccessLoss(fbError("functions/unavailable"));
    expect(redirectsToLogin()).toBe(false);
    noteAccessLoss(fbError("functions/permission-denied", NOT_MEMBER_MESSAGE));
    expect(redirectsToLogin()).toBe(true);
  });
});
