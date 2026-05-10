import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

// initializeFirestore (instead of getFirestore) lets us force long-polling,
// which avoids "WebChannelConnection RPC Listen stream transport errored"
// failures behind firewalls / corporate proxies / some ad blockers.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export const auth = getAuth(app);
export const functions = getFunctions(app, "europe-west1");

/**
 * Resolves once Anonymous Auth has assigned this browser a UID. All
 * Firestore access depends on it because the new rules require
 * `request.auth != null`.
 *
 * The credential is persisted in IndexedDB by the SDK, so subsequent
 * loads resolve almost instantly with the same UID.
 */
export const authReady: Promise<string> = new Promise((resolve, reject) => {
  const unsub = onAuthStateChanged(
    auth,
    async (user) => {
      if (user) {
        unsub();
        resolve(user.uid);
        return;
      }
      try {
        const cred = await signInAnonymously(auth);
        unsub();
        resolve(cred.user.uid);
      } catch (e) {
        unsub();
        reject(e);
      }
    },
    (err) => {
      unsub();
      reject(err);
    },
  );
});
