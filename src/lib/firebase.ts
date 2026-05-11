import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { useEffect, useState } from "react";

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

// ─── Google sign-in (optional upgrade) ─────────────────
const googleProvider = new GoogleAuthProvider();

export interface GoogleSignInResult {
  /** True if we upgraded an anonymous account to a permanent Google one
   *  while preserving the same Firebase UID. Member-Docs stay valid. */
  linked: boolean;
  /** True if we switched from one Firebase UID to another (e.g. previous
   *  Google account already existed). Member-Docs of the previous UID are
   *  no longer reachable — caller should re-join groups. */
  switched: boolean;
  /** Email reported by Google (best-effort). */
  email: string | null;
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const before = auth.currentUser;

  if (before?.isAnonymous) {
    try {
      const result = await linkWithPopup(before, googleProvider);
      return {
        linked: true,
        switched: false,
        email: result.user.email ?? null,
      };
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      // These two codes mean: the Google identity already belongs to
      // another Firebase user — we can't link, we can only sign in as
      // that user (losing the anonymous one).
      if (
        code !== "auth/credential-already-in-use" &&
        code !== "auth/email-already-in-use"
      ) {
        throw err;
      }
      // Fall through to plain sign-in.
    }
  }

  const result = await signInWithPopup(auth, googleProvider);
  const switched = !!before && before.uid !== result.user.uid;
  return {
    linked: false,
    switched,
    email: result.user.email ?? null,
  };
}

/** Signs out the current Firebase user (Google or anonymous) and
 *  immediately spins up a fresh anonymous session so the app keeps
 *  functioning. The caller should also reset group state + nav to login. */
export async function signOutAndReanon(): Promise<void> {
  try {
    await signOut(auth);
  } finally {
    await signInAnonymously(auth);
  }
}

/** React hook over Firebase auth state. Returns the currently signed-in
 *  user, or null until anonymous auth resolves. Re-renders on every auth
 *  state transition (anonymous → google, sign-out, …). */
export function useFirebaseUser(): User | null {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);
  return user;
}
