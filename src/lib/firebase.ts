import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  getRedirectResult,
  linkWithPopup,
  linkWithRedirect,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type AuthError,
  type User,
} from "firebase/auth";
import { isStandalonePWA } from "./pwa";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
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
// persistentLocalCache + multi-tab manager keeps reads working offline
// (essential for the installed PWA) and coordinates between tabs.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const auth = getAuth(app);
export const functions = getFunctions(app, "europe-west1");

// Lokale Emulatoren (npm run emu:shots, Mode "emulator" mit Projekt
// demo-geschenke) — muss vor dem ersten Auth-/Firestore-Zugriff passieren.
if (import.meta.env.VITE_USE_EMULATOR === "1") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

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

export type GoogleSignInSource = "login" | "settings";

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

export type GoogleSignInOutcome =
  | { kind: "popup"; result: GoogleSignInResult }
  /** Browser is about to reload (signInWithRedirect was triggered).
   *  Caller should not navigate or toast — App.tsx will pick the result
   *  back up on the next mount via consumeGoogleRedirectResult(). */
  | { kind: "redirect" };

export interface GoogleRedirectOutcome extends GoogleSignInResult {
  /** Which page initiated the redirect, so post-redirect handlers can
   *  apply the right UI rules (e.g. settings switched → re-join flow). */
  source: GoogleSignInSource;
}

const REDIRECT_STATE_KEY = "gm:google-redirect-state";

interface RedirectState {
  source: GoogleSignInSource;
  wasAnon: boolean;
  uidBefore: string | null;
}

// localStorage statt sessionStorage: iOS Safari löscht sessionStorage bei
// Cross-Origin-Redirects (ITP). Da signInWithRedirect zu
// {authDomain}/__/auth/handler navigiert (firebaseapp.com vs web.app =
// cross-origin) und zurück, würde sessionStorage zwischendurch verloren
// gehen — und wir hätten keinen State um Post-Redirect das richtige zu tun.
function readRedirectState(): RedirectState | null {
  const raw = localStorage.getItem(REDIRECT_STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RedirectState;
  } catch {
    return null;
  }
}
function writeRedirectState(state: RedirectState) {
  localStorage.setItem(REDIRECT_STATE_KEY, JSON.stringify(state));
}
function clearRedirectState() {
  localStorage.removeItem(REDIRECT_STATE_KEY);
}

/**
 * Starts the Google sign-in flow.
 *
 * Uses popups in normal browser tabs (best UX) and redirects in installed
 * PWAs, where iOS Safari WebView frequently freezes popups. The redirect
 * branch resolves with `{ kind: "redirect" }` and the actual sign-in result
 * arrives via {@link consumeGoogleRedirectResult} on the next page load.
 */
export async function signInWithGoogle(
  source: GoogleSignInSource,
): Promise<GoogleSignInOutcome> {
  const before = auth.currentUser;

  if (isStandalonePWA()) {
    const state: RedirectState = {
      source,
      wasAnon: !!before?.isAnonymous,
      uidBefore: before?.uid ?? null,
    };
    writeRedirectState(state);
    console.info("[auth] standalone-pwa → redirecting to Google", state);
    if (before?.isAnonymous) {
      await linkWithRedirect(before, googleProvider);
    } else {
      await signInWithRedirect(auth, googleProvider);
    }
    return { kind: "redirect" };
  }

  if (before?.isAnonymous) {
    try {
      const result = await linkWithPopup(before, googleProvider);
      return {
        kind: "popup",
        result: {
          linked: true,
          switched: false,
          email: result.user.email ?? null,
        },
      };
    } catch (err) {
      const authErr = err as AuthError;
      const code = authErr?.code ?? "";
      // The Google identity already belongs to another Firebase user.
      // Reuse the credential from the error to sign in directly — no
      // second popup, no risk of browser popup blocking.
      if (
        code === "auth/credential-already-in-use" ||
        code === "auth/email-already-in-use"
      ) {
        const credential = GoogleAuthProvider.credentialFromError(authErr);
        if (credential) {
          const result = await signInWithCredential(auth, credential);
          const switched = !!before && before.uid !== result.user.uid;
          return {
            kind: "popup",
            result: {
              linked: false,
              switched,
              email: result.user.email ?? null,
            },
          };
        }
        // No credential on the error — fall through to a fresh popup.
      } else {
        throw err;
      }
    }
  }

  const result = await signInWithPopup(auth, googleProvider);
  const switched = !!before && before.uid !== result.user.uid;
  return {
    kind: "popup",
    result: {
      linked: false,
      switched,
      email: result.user.email ?? null,
    },
  };
}

/**
 * Consumes the result of a previously-triggered signInWithRedirect /
 * linkWithRedirect. Robust gegen verloren gegangenen localStorage-State:
 * ruft getRedirectResult IMMER auf — Firebase Auth speichert das Ergebnis
 * intern in IndexedDB und gibt es uns auch ohne Pre-Redirect-State zurück.
 *
 * Wenn der State noch da ist, nutzen wir ihn für source + switched-Erkennung.
 * Wenn nicht (iOS Safari ITP hat ihn beim Cross-Origin-Redirect gelöscht),
 * fallen wir auf source="login" und switched=false zurück — der User landet
 * dann sauber in seiner ersten Gruppe.
 */
export async function consumeGoogleRedirectResult(): Promise<GoogleRedirectOutcome | null> {
  const state = readRedirectState();
  clearRedirectState();
  console.info("[auth] consumeGoogleRedirectResult: state=", state);

  try {
    const result = await getRedirectResult(auth);
    if (!result) {
      console.info("[auth] no redirect result");
      return null;
    }
    const linked = result.operationType === "link";
    const switched =
      !linked && !!state?.uidBefore && result.user.uid !== state.uidBefore;
    const outcome = {
      linked,
      switched,
      email: result.user.email ?? null,
      source: state?.source ?? "login",
    } as const;
    console.info("[auth] redirect result", outcome);
    return outcome;
  } catch (err) {
    const authErr = err as AuthError;
    const code = authErr?.code ?? "";
    if (
      code === "auth/credential-already-in-use" ||
      code === "auth/email-already-in-use"
    ) {
      const credential = GoogleAuthProvider.credentialFromError(authErr);
      if (credential) {
        const signInResult = await signInWithCredential(auth, credential);
        const switched =
          !!state?.uidBefore && signInResult.user.uid !== state.uidBefore;
        return {
          linked: false,
          switched,
          email: signInResult.user.email ?? null,
          source: state?.source ?? "login",
        };
      }
    }
    throw err;
  }
}

/** Signs out the current Firebase user (Google or anonymous) and
 *  immediately spins up a fresh anonymous session so the app keeps
 *  functioning. The caller should also reset group state + nav to login. */
export async function signOutAndReanon(): Promise<void> {
  // Push-Token dieses Geräts entfernen, solange die alte UID noch angemeldet
  // ist (sonst bekäme das Gerät weiter Pushes der alten Mitgliedschaften).
  // Dynamischer Import: messaging.ts importiert selbst aus dieser Datei.
  const { unregisterPushOnLogout } = await import("./messaging");
  await unregisterPushOnLogout();
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
