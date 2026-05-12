import { getMessaging, getToken, isSupported } from "firebase/messaging";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { app, auth, authReady, db } from "./firebase";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY ?? "";
const FCM_SW_URL = "/firebase-messaging-sw.js";

let cachedRegistration: ServiceWorkerRegistration | null = null;

async function ensureFcmServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (cachedRegistration) return cachedRegistration;
  cachedRegistration = await navigator.serviceWorker.register(FCM_SW_URL, {
    scope: "/firebase-cloud-messaging-push-scope",
  });
  // SW braucht die Firebase-Config beim ersten Run für initializeApp.
  // Wir lesen sie aus den Env-Vars, die der Client eh nutzt, und pushen
  // sie via postMessage rüber (statt sie hart in den SW-File zu schreiben).
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  const sendConfig = () =>
    cachedRegistration?.active?.postMessage({
      type: "FIREBASE_CONFIG",
      config,
    });
  if (cachedRegistration.active) {
    sendConfig();
  } else {
    // SW gerade installiert — auf activate warten.
    await new Promise<void>((resolve) => {
      const sw =
        cachedRegistration?.installing ?? cachedRegistration?.waiting ?? null;
      if (!sw) return resolve();
      sw.addEventListener("statechange", () => {
        if (sw.state === "activated") {
          sendConfig();
          resolve();
        }
      });
    });
  }
  return cachedRegistration;
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

export async function enablePushForGroup(groupId: string): Promise<void> {
  if (!VAPID_KEY) {
    throw new Error(
      "VITE_FIREBASE_VAPID_KEY fehlt — Web-Push-Cert in Firebase Console anlegen",
    );
  }
  const uid = await authReady;
  if (Notification.permission === "default") {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Benachrichtigungen nicht erlaubt");
  } else if (Notification.permission !== "granted") {
    throw new Error("Benachrichtigungen sind im Browser blockiert");
  }
  const registration = await ensureFcmServiceWorker();
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("Kein FCM-Token erhalten");

  // Token unter pushTokens/{uid} als Map ablegen. Mehrere Geräte = mehrere
  // Keys unter dem selben Doc. Updates pro-Key via dot-notation, damit
  // fremde Tokens beim Schreiben nicht plattgemacht werden.
  await setDoc(
    doc(db, "pushTokens", uid),
    {
      [token]: {
        ua: navigator.userAgent,
        platform: navigator.platform ?? "",
        addedAt: serverTimestamp(),
      },
    },
    { merge: true },
  );

  // Pro Gruppe Opt-In setzen — Cloud Function liest dieses Feld vor dem
  // Versand. So bleibt das Token am User, aber jede Gruppe ist getrennt
  // zu- oder abschaltbar.
  await updateDoc(doc(db, "groups", groupId, "members", uid), {
    notifyStack: true,
  });
}

export async function disablePushForGroup(groupId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await updateDoc(doc(db, "groups", groupId, "members", uid), {
    notifyStack: false,
  });
  // Token selbst lassen wir liegen — User könnte in einer anderen Gruppe
  // Push noch aktiv haben. Cleanup könnte später als Cloud-Function laufen.
}

/**
 * Reactive hook: ist Push für (uid, groupId) aktiv? Liest das notifyStack-
 * Feld aus dem eigenen Member-Doc. Liefert null während des ersten Loads.
 */
export function usePushEnabled(groupId: string | null): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    if (!groupId) {
      setEnabled(null);
      return;
    }
    let cancelled = false;
    let unsub: (() => void) | null = null;
    (async () => {
      const uid = await authReady;
      if (cancelled) return;
      unsub = onSnapshot(
        doc(db, "groups", groupId, "members", uid),
        (snap) => {
          if (cancelled) return;
          setEnabled(snap.data()?.notifyStack === true);
        },
        () => {
          if (cancelled) return;
          setEnabled(false);
        },
      );
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [groupId]);
  return enabled;
}
