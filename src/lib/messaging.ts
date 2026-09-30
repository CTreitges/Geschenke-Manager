// Web-Push im Client: Service-Worker-Registrierung, FCM-Token-Lebenszyklus,
// Opt-ins pro Gruppe und Navigation aus Notification-Klicks.
// Context7: firebase-js-sdk messaging (getToken mit eigener
// serviceWorkerRegistration, deleteToken).

import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";
import {
  deleteField,
  doc,
  FieldPath,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { app, auth, authReady, db, functions } from "./firebase";
import { isStandalonePWA } from "./pwa";
import {
  clearStoredToken,
  derivePushState,
  effectivePushPrefs,
  isIosDevice,
  needsTokenSync,
  readStoredToken,
  writeStoredToken,
  type PushPrefs,
  type PushState,
} from "./pushState";

export type { PushPrefs, PushState } from "./pushState";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY ?? "";
const FCM_SW_URL = "/firebase-messaging-sw.js";
// NICHT ändern: an dieser Registrierung hängt die Push-Subscription und damit
// jeder bereits gespeicherte Token.
const FCM_SW_SCOPE = "/firebase-cloud-messaging-push-scope";
const SW_ACTIVATE_TIMEOUT_MS = 10_000;
const PUSH_CHANGE_EVENT = "gm:push-change";

function notifyPushChange() {
  window.dispatchEvent(new Event(PUSH_CHANGE_EVENT));
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Registriert den FCM-Worker und wartet (mit Timeout) bis er aktiv ist. */
async function ensureFcmServiceWorker(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register(FCM_SW_URL, {
    scope: FCM_SW_SCOPE,
  });
  if (registration.active) return registration;
  const worker = registration.installing ?? registration.waiting;
  if (!worker) throw new Error("Service Worker ließ sich nicht starten");
  await withTimeout(
    new Promise<void>((resolve, reject) => {
      const onChange = () => {
        if (worker.state === "activated" || registration.active) {
          worker.removeEventListener("statechange", onChange);
          resolve();
        } else if (worker.state === "redundant") {
          worker.removeEventListener("statechange", onChange);
          reject(new Error("Service Worker konnte nicht installiert werden"));
        }
      };
      worker.addEventListener("statechange", onChange);
      onChange(); // falls er inzwischen schon aktiv ist
    }),
    SW_ACTIVATE_TIMEOUT_MS,
    "Service Worker wurde nicht rechtzeitig aktiv",
  );
  return registration;
}

export async function isPushSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  if (!("serviceWorker" in navigator)) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

/**
 * Holt den FCM-Token dieses Geräts und schreibt ihn als Upsert nach
 * pushTokens/{uid}[token]. Ein vorher unter derselben UID gemerkter, anderer
 * Token wird entfernt (Token-Rotation).
 */
async function registerDeviceToken(uid: string, opts: { updateWorker?: boolean } = {}): Promise<string> {
  if (!VAPID_KEY) {
    throw new Error("VITE_FIREBASE_VAPID_KEY fehlt — Web-Push-Cert in Firebase Console anlegen");
  }
  const registration = await ensureFcmServiceWorker();
  // Holt neue SW-Versionen (z. B. diesen Push-Fix) auch zu Bestandsgeräten.
  if (opts.updateWorker) registration.update().catch(() => undefined);
  const token = await getToken(getMessaging(app), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("Kein FCM-Token erhalten");

  const stored = readStoredToken();
  const ref = doc(db, "pushTokens", uid);
  const meta = {
    ua: navigator.userAgent,
    platform: navigator.platform ?? "",
    lastSeenAt: serverTimestamp(),
  };
  const isNew = !stored || stored.token !== token || stored.uid !== uid;
  // Keys sind Tokens (setDoc nimmt sie wörtlich, keine Feldpfade); merge
  // lässt fremde Geräte-Tokens und addedAt bestehender Einträge stehen.
  await setDoc(ref, { [token]: isNew ? { ...meta, addedAt: serverTimestamp() } : meta }, { merge: true });
  if (stored && stored.uid === uid && stored.token !== token) {
    await updateDoc(ref, new FieldPath(stored.token), deleteField()).catch(() => undefined);
  }
  writeStoredToken({ token, uid, syncedAt: Date.now() });
  notifyPushChange();
  return token;
}

/**
 * Push für dieses Gerät einrichten und in der Gruppe beide Arten
 * einschalten. MUSS direkt aus dem Klick-Handler aufgerufen werden:
 * Safari/iOS akzeptiert die Berechtigungsanfrage nur in der User-Geste.
 */
export async function enablePushForGroup(groupId: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    notifyPushChange();
    throw new Error(
      permission === "denied"
        ? "Benachrichtigungen sind im Browser blockiert"
        : "Benachrichtigungen nicht erlaubt",
    );
  }
  const uid = await authReady;
  await registerDeviceToken(uid);
  await updateDoc(doc(db, "groups", groupId, "members", uid), {
    notifyStack: true,
    notifyPolls: true,
  });
}

/** Einzelne Push-Arten der Gruppe an/aus (Token bleibt am Gerät). */
export async function setPushPrefs(
  groupId: string,
  prefs: { notifyStack?: boolean; notifyPolls?: boolean },
): Promise<void> {
  const uid = await authReady;
  const patch: { notifyStack?: boolean; notifyPolls?: boolean } = {};
  if (typeof prefs.notifyStack === "boolean") patch.notifyStack = prefs.notifyStack;
  if (typeof prefs.notifyPolls === "boolean") patch.notifyPolls = prefs.notifyPolls;
  if (Object.keys(patch).length === 0) return;
  await updateDoc(doc(db, "groups", groupId, "members", uid), patch);
}

/**
 * Beim App-Start: hält den Token frisch (höchstens 1×/Tag), trägt lastSeenAt
 * nach und holt den neuen Service Worker. Kein Prompt, keine UI — läuft nur,
 * wenn die Berechtigung schon erteilt ist.
 */
export async function syncPushToken(): Promise<void> {
  try {
    if (!VAPID_KEY) return;
    if (!(await isPushSupported())) return;
    if (Notification.permission !== "granted") return;
    const uid = await authReady;
    if (!needsTokenSync(readStoredToken(), uid, Date.now())) return;
    await registerDeviceToken(uid, { updateWorker: true });
  } catch (err) {
    console.warn("[push] Token-Sync fehlgeschlagen", err);
  }
}

/**
 * Beim Abmelden (vor einem UID-Wechsel aufrufen): Token bei FCM löschen,
 * aus pushTokens/{uid} entfernen und den lokalen Merker vergessen. Die
 * Gruppen-Schalter bleiben (gelten für andere Geräte). Wirft nie.
 */
export async function unregisterPushOnLogout(): Promise<void> {
  const stored = readStoredToken();
  clearStoredToken();
  const uid = auth.currentUser?.uid;
  try {
    if (stored && uid && stored.uid === uid) {
      await withTimeout(
        updateDoc(doc(db, "pushTokens", uid), new FieldPath(stored.token), deleteField()),
        4000,
        "Token-Löschen dauert zu lange",
      );
    }
  } catch (err) {
    console.warn("[push] Token-Eintrag nicht gelöscht", err);
  }
  try {
    const registration =
      typeof navigator !== "undefined" && "serviceWorker" in navigator
        ? await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE)
        : undefined;
    if (registration && (await isPushSupported())) {
      await withTimeout(deleteToken(getMessaging(app)), 4000, "deleteToken dauert zu lange");
    }
  } catch (err) {
    console.warn("[push] deleteToken fehlgeschlagen", err);
  }
  notifyPushChange();
}

/** Test-Push an alle Geräte des Aufrufers; liefert die Anzahl verschickter Meldungen. */
export async function sendTestPush(groupId: string): Promise<number> {
  const call = httpsCallable<{ groupId: string }, { sent: number }>(functions, "sendTestPush");
  const res = await call({ groupId });
  return res.data.sent;
}

type MemberPushFlags = { notifyStack?: boolean; notifyPolls?: boolean };

function currentPermission(): NotificationPermission | null {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : null;
}

/**
 * Zustand von Push auf diesem Gerät plus die Schalter der Gruppe.
 * `state` ist null, solange die Unterstützung noch geprüft wird.
 */
export function usePushState(groupId: string | null): { state: PushState | null; prefs: PushPrefs } {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [, setTick] = useState(0); // Neuberechnung bei Push-/Sichtbarkeits-Änderung
  const [member, setMember] = useState<MemberPushFlags | null>(null);

  useEffect(() => {
    let cancelled = false;
    isPushSupported().then((s) => {
      if (!cancelled) setSupported(s);
    });
    // Berechtigung kann sich in den Browser-Einstellungen ändern.
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(PUSH_CHANGE_EVENT, bump);
    document.addEventListener("visibilitychange", bump);
    return () => {
      cancelled = true;
      window.removeEventListener(PUSH_CHANGE_EVENT, bump);
      document.removeEventListener("visibilitychange", bump);
    };
  }, []);

  useEffect(() => {
    setMember(null);
    if (!groupId) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;
    authReady.then((uid) => {
      if (cancelled) return;
      unsub = onSnapshot(
        doc(db, "groups", groupId, "members", uid),
        (snap) => {
          if (!cancelled) setMember((snap.data() as MemberPushFlags | undefined) ?? {});
        },
        () => {
          if (!cancelled) setMember({});
        },
      );
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [groupId]);

  const stored = readStoredToken();
  const uid = auth.currentUser?.uid ?? null;
  const state =
    supported === null
      ? null
      : derivePushState({
          supported,
          ios: isIosDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
          standalone: isStandalonePWA(),
          permission: currentPermission(),
          registered: !!stored && !!uid && stored.uid === uid,
        });
  return { state, prefs: effectivePushPrefs(member) };
}

/**
 * Hört auf GM_NAVIGATE vom Push-Worker (Klick auf eine Meldung bei offener
 * App) und navigiert im Router. Muss innerhalb des Routers laufen.
 */
export function usePushNavigation(): void {
  const navigate = useNavigate();
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; url?: unknown } | null;
      if (data?.type !== "GM_NAVIGATE" || typeof data.url !== "string") return;
      // Nur App-interne Pfade.
      if (!data.url.startsWith("/") || data.url.startsWith("//")) return;
      navigate(data.url);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [navigate]);
}
