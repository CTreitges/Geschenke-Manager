// Web-Push im Client: Service-Worker-Registrierung, FCM-Token-Lebenszyklus,
// Opt-ins pro Gruppe und Navigation aus Notification-Klicks.
// Context7: firebase-js-sdk messaging (getToken mit eigener
// serviceWorkerRegistration, deleteToken). Token-Lebenszyklus gegen
// @firebase/messaging 0.12.12 (getTokenInternal/deleteTokenInternal) geprüft:
// getToken holt bei geändertem Endpoint oder fehlender Subscription selbst
// einen neuen Token, deleteToken meldet ihn bei FCM ab und kündigt das Abo.

import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";
import {
  deleteField,
  doc,
  FieldPath,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { app, auth, authReady, db, functions, useFirebaseUser } from "./firebase";
import { isStandalonePWA } from "./pwa";
import {
  clearStoredToken,
  derivePushState,
  effectivePushPrefs,
  isIosDevice,
  needsTokenSync,
  readStoredToken,
  pushPrefsOnEnable,
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
const DELETE_TOKEN_TIMEOUT_MS = 4000;

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

/**
 * Aktuelle UID für Push-Schreibvorgänge. `authReady` kennt nur die UID beim
 * App-Start; nach „Bei Google abmelden“/„Google trennen“ (signOutAndReanon)
 * läuft die Seite ohne Reload mit einer neuen anonymen UID weiter.
 */
async function currentUid(): Promise<string> {
  const startUid = await authReady;
  return auth.currentUser?.uid ?? startUid;
}

/** Endpoint der Push-Subscription am FCM-Worker (null = keine/unbekannt). */
async function currentPushEndpoint(registration?: ServiceWorkerRegistration): Promise<string | null> {
  try {
    const reg = registration ?? (await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE));
    const sub = await reg?.pushManager?.getSubscription();
    return sub?.endpoint ?? null;
  } catch {
    return null;
  }
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
 * Token wird entfernt (Token-Rotation). Gehört der gemerkte Token einer
 * anderen UID (geteiltes Gerät, Abmelden ohne erfolgreiches deleteToken,
 * Google-Kontowechsel), wird er zuerst bei FCM abgemeldet: Den Eintrag unter
 * pushTokens/{alteUid} dürfen wir nicht löschen (Rules), ein neuer Token
 * sorgt aber dafür, dass dort nur noch ein toter Token liegt, den der Server
 * beim nächsten Versand wegräumt.
 */
async function registerDeviceToken(uid: string, opts: { updateWorker?: boolean } = {}): Promise<string> {
  if (!VAPID_KEY) {
    throw new Error("VITE_FIREBASE_VAPID_KEY fehlt — Web-Push-Cert in Firebase Console anlegen");
  }
  const registration = await ensureFcmServiceWorker();
  // Holt neue SW-Versionen (z. B. diesen Push-Fix) auch zu Bestandsgeräten.
  if (opts.updateWorker) registration.update().catch(() => undefined);
  const messaging = getMessaging(app);
  const stored = readStoredToken();
  if (stored && stored.uid !== uid) {
    // Scheitert das, lieber ohne Push als mit den Pushes der alten UID —
    // der Merker bleibt, der nächste Sync versucht es erneut.
    await withTimeout(
      deleteToken(messaging),
      DELETE_TOKEN_TIMEOUT_MS,
      "Alte Geräte-Anmeldung ließ sich nicht entfernen – bitte später erneut versuchen",
    );
  }
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("Kein FCM-Token erhalten");

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
  writeStoredToken({ token, uid, syncedAt: Date.now(), endpoint: await currentPushEndpoint(registration) });
  notifyPushChange();
  return token;
}

/**
 * Push für dieses Gerät einrichten und, solange in der Gruppe keine Art an
 * ist, beide einschalten; bewusste Schalter bleiben stehen. MUSS direkt aus dem Klick-Handler aufgerufen werden:
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
  const uid = await currentUid();
  await registerDeviceToken(uid);
  const ref = doc(db, "groups", groupId, "members", uid);
  const patch = pushPrefsOnEnable((await getDoc(ref)).data() as MemberPushFlags | undefined);
  if (patch) await updateDoc(ref, patch);
}

/** Einzelne Push-Arten der Gruppe an/aus (Token bleibt am Gerät). */
export async function setPushPrefs(
  groupId: string,
  prefs: { notifyStack?: boolean; notifyPolls?: boolean },
): Promise<void> {
  const uid = await currentUid();
  const patch: { notifyStack?: boolean; notifyPolls?: boolean } = {};
  if (typeof prefs.notifyStack === "boolean") patch.notifyStack = prefs.notifyStack;
  if (typeof prefs.notifyPolls === "boolean") patch.notifyPolls = prefs.notifyPolls;
  if (Object.keys(patch).length === 0) return;
  await updateDoc(doc(db, "groups", groupId, "members", uid), patch);
}

/**
 * „Gruppe auf diesem Gerät verlassen“: schaltet Push für DIESE Gruppe ab
 * (notifyStack/notifyPolls = false im eigenen Member-Doc, das dabei stehen
 * bleibt). Der Geräte-Token bleibt, damit andere Gruppen derselben UID auf
 * dem Gerät weiter Push bekommen; nach erneutem Beitritt kommt erst wieder
 * etwas, wenn man es in den Einstellungen einschaltet. Vor dem Austritt
 * aufrufen, solange die UID die aktuelle ist. Wirft nie.
 */
export async function disablePushForGroup(groupId: string): Promise<void> {
  try {
    await setPushPrefs(groupId, { notifyStack: false, notifyPolls: false });
  } catch (err) {
    console.warn("[push] Gruppen-Push nicht abgeschaltet", err);
  }
}

/**
 * Beim App-Start: hält den Token frisch (höchstens 1×/Tag), trägt lastSeenAt
 * nach und holt den neuen Service Worker. Hat der Browser das Push-Abo
 * erneuert oder verloren (Endpoint weicht vom Merker ab) oder meldet der
 * Worker `pushsubscriptionchange` (`force`), sofort — ohne Tages-Takt. Kein
 * Prompt, keine UI — läuft nur, wenn die Berechtigung schon erteilt ist.
 */
export async function syncPushToken(opts: { force?: boolean } = {}): Promise<void> {
  try {
    if (!VAPID_KEY) return;
    if (!(await isPushSupported())) return;
    if (Notification.permission !== "granted") return;
    const uid = await currentUid();
    const endpoint = await currentPushEndpoint();
    if (!opts.force && !needsTokenSync(readStoredToken(), uid, Date.now(), endpoint)) return;
    await registerDeviceToken(uid, { updateWorker: true });
  } catch (err) {
    console.warn("[push] Token-Sync fehlgeschlagen", err);
  }
}

/**
 * Beim Abmelden (vor einem UID-Wechsel aufrufen): Token bei FCM löschen,
 * aus pushTokens/{uid} entfernen und den lokalen Merker vergessen. Die
 * Gruppen-Schalter bleiben (gelten für andere Geräte). Scheitert deleteToken
 * (Timeout/Fehler), bleibt der Merker mit der alten UID stehen: Der nächste
 * Sync unter neuer UID meldet den Token dann erneut ab, bevor er einen neuen
 * holt (registerDeviceToken). Wirft nie.
 */
export async function unregisterPushOnLogout(): Promise<void> {
  const stored = readStoredToken();
  const uid = auth.currentUser?.uid;
  try {
    if (stored && uid && stored.uid === uid) {
      await withTimeout(
        updateDoc(doc(db, "pushTokens", uid), new FieldPath(stored.token), deleteField()),
        DELETE_TOKEN_TIMEOUT_MS,
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
      await withTimeout(deleteToken(getMessaging(app)), DELETE_TOKEN_TIMEOUT_MS, "deleteToken dauert zu lange");
    }
    clearStoredToken();
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
export function usePushState(groupId: string | null): { state: PushState | null; prefs: PushPrefs; prefsLoaded: boolean } {
  // Reagiert auch auf einen UID-Wechsel ohne Reload (PUSH-01).
  const uid = useFirebaseUser()?.uid ?? null;
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
    if (!groupId || !uid) return;
    let cancelled = false;
    const unsub = onSnapshot(
      doc(db, "groups", groupId, "members", uid),
      (snap) => {
        if (!cancelled) setMember((snap.data() as MemberPushFlags | undefined) ?? {});
      },
      () => {
        if (!cancelled) setMember({});
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [groupId, uid]);

  const stored = readStoredToken();
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
  return { state, prefs: effectivePushPrefs(member), prefsLoaded: member !== null };
}

/**
 * Nachricht vom Push-Worker verarbeiten: GM_NAVIGATE (Klick auf eine Meldung
 * bei offener App) navigiert zu App-internen Pfaden,
 * GM_PUSH_SUBSCRIPTION_CHANGE (Browser hat das Push-Abo erneuert) holt
 * sofort einen neuen Token.
 */
export function handlePushWorkerMessage(
  data: unknown,
  deps: { navigate: (url: string) => void; resync: () => void },
): void {
  const msg = data as { type?: unknown; url?: unknown } | null;
  if (msg?.type === "GM_PUSH_SUBSCRIPTION_CHANGE") {
    deps.resync();
    return;
  }
  if (msg?.type !== "GM_NAVIGATE" || typeof msg.url !== "string") return;
  // Nur App-interne Pfade.
  if (!msg.url.startsWith("/") || msg.url.startsWith("//")) return;
  deps.navigate(msg.url);
}

/**
 * Hört auf Nachrichten vom Push-Worker (handlePushWorkerMessage) und
 * navigiert im Router. Muss innerhalb des Routers laufen.
 */
export function usePushNavigation(): void {
  const navigate = useNavigate();
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) =>
      handlePushWorkerMessage(event.data, {
        navigate,
        resync: () => void syncPushToken({ force: true }),
      });
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [navigate]);
}
